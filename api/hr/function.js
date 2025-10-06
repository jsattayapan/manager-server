
const {hrDB} = require('./../../database')
const authFunc = require('./../authentication/function')
const helper = require('./../helper')
const moment = require('moment')

const getDepartments = async () => {
    let departments = await hrDB('department')
    return {status: true , departments}
}


const getEmployeeListForHr = async ({employeeId = ''}) => {
    let list 
    if(employeeId === ''){
        list = await hrDB('employee').leftJoin('department', 'department.id', 'employee.departmentId').select('employee.*', 'department.name as departmentName')
    }else{
        list = await hrDB('employee').leftJoin('department', 'department.id', 'employee.departmentId').select('employee.*', 'department.name as departmentName').where('employee.id', employeeId)
    }
    
    return {status: true , list}
}

const getEmployeeNoteListById = async ({employeeId}) => {
    let payload = await hrDB('employee_note').where({employeeId})
    let noteList = []      
    for(const note of payload){
        const createBy = await authFunc.getUserInfo({username: note.createBy})
        noteList = [...noteList, {...note, createBy}]
    }
    
    return {status: true , noteList}
}


const getLogsByEmployeeId = async ({employeeId}) => {
    let payload = await hrDB('employee_logs').where({employeeId})
    let logList = []      
    for(const log of payload){
        const createBy = await authFunc.getUserInfo({username: log.createBy})
        logList = [...logList, {...log, createBy}]
    }
    
    return {status: true , logList}
}


const getLeaveById = async ({employeeId}) => {
    let payload = await hrDB('employee_leave').where({employeeId})
    
    return {status: true , leaveList: payload}
}


const getEmployeeTimeScanById = async ({ employeeId, month }) => {
  const base = moment(month);
  const end = base.clone().date(20);
  const start = base.clone().subtract(1, "month").date(21);

  // 🔹 Query ข้อมูลทั้งหมดช่วงนั้น (ดึงครั้งเดียว)
  const [timeScanListAll, timetableList, OTListAll, leaveList] = await Promise.all([
    hrDB("finger_scan_time")
      .where("id", employeeId)
      .andWhereRaw(
        `STR_TO_DATE(date, '%d/%m/%Y') BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y')`,
        [start.format("DD/MM/YYYY"), end.format("DD/MM/YYYY")]
      ),
    hrDB("employee_timetable")
      .where("employeeId", employeeId)
      .andWhereRaw(
        `STR_TO_DATE(date, '%d/%m/%Y') BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y')`,
        [start.format("DD/MM/YYYY"), end.format("DD/MM/YYYY")]
      ),
    hrDB("OT_timetable")
      .where("employeeId", employeeId)
      .andWhereRaw(
        `STR_TO_DATE(date, '%d/%m/%Y') BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y')`,
        [start.format("DD/MM/YYYY"), end.format("DD/MM/YYYY")]
      ),
    hrDB("employee_leave")
      .where("employeeId", employeeId)
      .andWhereBetween("startDate", [start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD")]),
  ]);

  // 🔹 แปลงข้อมูลทั้งหมดเป็น Map เพื่อค้นหาเร็ว O(1)
  const timetableMap = Object.fromEntries(timetableList.map(t => [t.date, t]));
  const otMap = Object.fromEntries(OTListAll.map(o => [o.date, o]));
  const leaveMap = Object.fromEntries(
    leaveList.map(l => [moment(l.startDate).format("DD/MM/YYYY"), l])
  );
  const scanMap = timeScanListAll.reduce((acc, scan) => {
    if (!acc[scan.date]) acc[scan.date] = [];
    acc[scan.date].push(scan);
    return acc;
  }, {});

  // 🔹 เตรียมวันที่ทั้งหมด
  const dates = [];
  const cur = start.clone();
  while (cur.isSameOrBefore(end, "day")) {
    dates.push(cur.format("DD/MM/YYYY"));
    cur.add(1, "day");
  }

  // 🔹 ฟังก์ชันช่วยคำนวณเวลาทำงาน
  const calcWork = (startTime, endTime, timetable, otTimetable, obj) => {
    if (!timetable) return;

    const { startTime: st, breakTime, continueTime, endTime: et } = timetable;

    if (breakTime) {
      // มีพักกลางวัน
      const part1 = helper.calcScanMinutesWithinSchedule(startTime, endTime, moment(st).format("HH:mm"), moment(breakTime).format("HH:mm"));
      const part2 = helper.calcScanMinutesWithinSchedule(startTime, endTime, moment(continueTime).format("HH:mm"), moment(et).format("HH:mm"));
      obj.countableWorkingTime += part1 + part2;
      obj.workDuration += helper.getMinutesBetween(moment(st).format("HH:mm"), moment(breakTime).format("HH:mm"));
      obj.workDuration += helper.getMinutesBetween(moment(continueTime).format("HH:mm"), moment(et).format("HH:mm"));
    } else {
      // ไม่มีพักกลางวัน
      obj.countableWorkingTime += helper.calcScanMinutesWithinSchedule(startTime, endTime, moment(st).format("HH:mm"), moment(et).format("HH:mm"));
      obj.workDuration += helper.getMinutesBetween(moment(st).format("HH:mm"), moment(et).format("HH:mm"));
    }

    if (otTimetable) {
      const { start: ots, end: ote } = otTimetable;
      obj.countableOTTime += helper.calcScanMinutesWithinSchedule(startTime, endTime, moment(ots).format("HH:mm"), moment(ote).format("HH:mm"));
    }
  };

  // 🔹 วนลูปแต่ละวัน
  const result = dates.map(d => {
    const obj = {
      date: d,
      result: "uncountable",
      countableOTTime: 0,
      workDuration: 0,
      countableWorkingTime: 0,
    };

    const scanList = scanMap[d] || [];
    const timetable = timetableMap[d];
    const otTimetable = otMap[d];
    const leave = leaveMap[d];

    // ✅ Leave
    if (leave) {
      obj.leave = leave;
      obj.remark = leave.remark !== '' ? leave.remark : leave.type;
      obj.result = "leave";
      if (["ลา extra", "ลาป่วย"].includes(leave.type)) obj.extraLeave = 1;
      if (leave.type === "ลาพักร้อน") obj.yearlyLeave = 1;
    }

    // ✅ Timetable
    if (timetable) {
      obj.timetable = timetable;
      if (timetable.dayOff) {
        obj.result = "dayOff";
        obj.remark = timetable.dayOff;
      } else {
        obj.result = "working";
      }
    }

    // ✅ OT
    if (otTimetable) {
      obj.ot_timetable = otTimetable;
      obj.result += "+OT";
    }

    // ✅ Scan Types
    const scanByType = scanList.reduce((acc, s) => ((acc[s.type] = s), acc), {});
    Object.assign(obj, scanByType);

    // ✅ คำนวณเฉพาะวันทำงานปกติ
    if (!["dayOff", "leave"].includes(obj.result)) {
      const { start, break: br, continue: cont, end } = obj;
      const count = scanList.length;

      if (![2, 4].includes(count)) {
      } else if (count === 2 && start && end) {
        calcWork(start.time, end.time, timetable, otTimetable, obj);
      } else if (count === 4 && start && br && cont && end) {
        // แยกคำนวณเป็น 2 ช่วง
        calcWork(start.time, br.time, timetable, otTimetable, obj);
        calcWork(cont.time, end.time, timetable, otTimetable, obj);
      }
    }

    obj.workDuration = Math.abs(obj.workDuration);
    return obj;
  });

  return { status: true, payload: result };
};


module.exports = {
    getDepartments,
    getEmployeeListForHr,
    getEmployeeNoteListById,
    getLogsByEmployeeId,
    getLeaveById,
    getEmployeeTimeScanById
}