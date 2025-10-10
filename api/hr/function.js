
const {hrDB} = require('./../../database')
const authFunc = require('./../authentication/function')
const uniqid = require('uniqid')
const helper = require('./../helper')
const moment = require('moment')
const pdfCreator = require('./pdf_creator')

const getDepartments = async () => {
    let departments = await hrDB('department')
    return {status: true , departments}
}

const getPositions = async () => {
    let positionList = await hrDB('position')
    return {status: true , positionList}
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


      if(obj.leave){
            obj['result'] = 'leave'
            if(obj.leave.type === 'ลาป่วย'){
              obj['sickLeave'] = 1;
            }
            if(obj.leave.type === 'ลา Extra'){
              obj['extraLeave'] = 1;
            }
            if(obj.leave.type === 'ลาพักร้อน'){
              obj['yearlyLeave'] = 1;
            }
            if(obj.leave.type === 'ลากิจ'){
              obj['businessLeave'] = 1;
            }
              obj['remark'] = obj.leave.remark
          }
    return obj;
  });

  return { status: true, payload: result };
};

const getEmployeeChecklistLink = async ({employeeId}) => {
  const checklistLinkList = await hrDB('checklist_link')
  .leftJoin('checklist', 'checklist.id', 'checklist_link.checklistId')
  .where('checklist_link.linkId', employeeId)
  .select ('checklist_link.*', 'checklist.name as checklistName', 'checklist.type')
  return { status: true, checklistLinkList}
}

const getWarningById = async ({employeeId}) => {
  let warningList = await hrDB('employee_warning').where({employeeId})
  let result = []
  for(let warning of warningList){
    let foundUser = await authFunc.getUserInfo({username: warning.createBy})
    if(foundUser){
      warning['createBy'] = foundUser.first_name
    }else{
      warning['createBy'] = 'ไม่พบข้อมูล'
    }
    result = [...result , warning]
  }
  return { status: true, warningList: result}
}


const getChecklistList = async () => {
  let checklistList = await hrDB('checklist')

  return { status: true, checklistList}
}


const getEmployeeDocumentById = async ({employeeId}) => {
  let documentList = await hrDB('employee_document').where({employeeId})

  return { status: true, documentList}
}


const getChecklistRecordListByEmployee = async ({employeeId}) => {
  let checklistRecordList = await hrDB('checklist_link_record')
  .leftJoin('checklist', 'checklist.id', 'checklist_link_record.checklistId')
  .where('checklist_link_record.employeeId', employeeId)
  .select('checklist_link_record.*', ' checklist.name')

  return { status: true, checklistRecordList}
}


const updateEmployeeAttribute = async ({employeeId, attribute, value, createBy}) => {
  await hrDB('employee').where({id: employeeId}).update(attribute, value)
  const attributeList = {
    dob :'วันเกิด',
    phone: 'เบอร์โทร',
    nationalId: 'หมายเลขประชาชน/พาสปอร์ต',
    address: 'ที่อยู่',
    bankAccount: 'บัญชีรับเงินเดือน',
    defaultDayOff: 'วันหยุดประจำสัปดาห์'
  }
  const inputOptions = {
    1: 'วันอาทิตย์',   // Sunday
    2: 'วันจันทร์',     // Monday
    3: 'วันอังคาร',     // Tuesday
    4: 'วันพุธ',        // Wednesday
    5: 'วันพฤหัสบดี',   // Thursday
    6: 'วันศุกร์',      // Friday
    7: 'วันเสาร์'       // Saturday
  }
  if(attribute === 'defaultDayOff'){
    value = inputOptions[value]
  }
  await hrDB('employee_logs').insert({
      employeeId,
      detail: `อัพเดท ${attributeList[attribute]}: ${value}`,
      createBy,
      timestamp: new Date()
  })
  return { status: true}
}


const submitNoteToEmployee = async ({employeeId, createBy, note, type = 'admin'}) => {
  await hrDB('employee_note').insert({employeeId, createBy, note, type, id: uniqid(), timestamp: new Date()})
  return { status: true}
}


const deleteEmployeeNoteByNoteId = async ({id}) => {
  await hrDB('employee_note').where({id}).del()
  return { status: true}
}

const updateEmployeePosition = async ({username, positionId, employeeId, role, departmentId}) => {
  await hrDB('employee').where({id: employeeId}).update({positionId, role, departmentId})
  await hrDB('employee_logs').insert({
      employeeId,
      detail: `ปรับตำแหน่งงาน: ${role}`,
      createBy: username,
      timestamp: new Date()
  })
  return { status: true}
}


const createLinkChecklistEmployee = async ({checklistId, date, employeeId}) => {
  await hrDB('checklist_link').insert({
    checklistId,
    linkId: employeeId,
    nextCheck: date,
    id: uniqid()
  })
  return { status: true}
}


const submitDocument = async ({employeeId, name, filename}) => {
  await hrDB('employee_document').insert({
    employeeId,
    name,
    filename,
    createAt: new Date()
  })
  return { status: true}
}


const resignEmployee = async ({id, username, remark}) => {
    const emp = await hrDB('employee').where({id, active: 1}).first()
    if(emp){
        await hrDB('employee_logs').insert({
              employeeId:id,
              detail: `ปรับสถาณะออกงาน: ${remark} \nระยะทำงาน: ${emp.startJob} - ${moment().format('DD/MM/YYYY')}\nตำแหน่ง: ${emp.role}`,
              createBy: username,
              timestamp: new Date()
          })
        await hrDB('employee').where({id}).update({
            active: false,
            lineId: null,
            remainSickLeaveDay: 0,
            remainYearlyLeaveDay: 0
        })
        await hrDB('checklist_link').where({linkId: id}).update({
            active: 0
        })
        await hrDB('dormitory_resident').where({employeeId: id}).del()
        await hrDB('dormitory_bill').where({employeeId: id}).update({
            employeeId: null
        })
        await hrDB('employee_public_holiday').where({employeeId: id, status: 'valid'}).del()
        await hrDB('employee_finger_prints').where({employeeId: id}).del()
        return { status: true}
    }else{
        return { status: false, msg: 'ไม่พบรหัสพนักงาน กรุณาลองใหม่อีกครั้ง'}
    }
}



const submitProbationResult = async ({employeeId, level, status, salary, incentive, createBy}) => {
    if(status){
        await hrDB('employee').where({id:employeeId}).update({ performanceStatus: 'Average', level})
        if(salary !== ''){
         await hrDB('salary').where({employeeId, active: 1}).update({active: 0})
        await hrDB('salary').insert({employeeId, salaryAmount: salary, positionAmount: incentive, createAt: new Date(), active: 1, createBy})   
        }
        await hrDB('employee_logs').insert({
              employeeId,
              detail: `ผ่านการทดลองงาน ปรับเป็นระดับ: ${level}`,
              createBy,
              timestamp: new Date()
          })
        
    }else{
        await hrDB('employee').where({id:employeeId}).update({ performanceStatus: 'Fail'})
        await hrDB('employee_logs').insert({
              employeeId,
              detail: `ไม่ผ่านการทดลองงาน`,
              createBy,
              timestamp: new Date()
          })
    }
    return { status: true}
 
}


module.exports = {
    getDepartments,
    getEmployeeListForHr,
    getEmployeeNoteListById,
    getLogsByEmployeeId,
    getLeaveById,
    getEmployeeTimeScanById,
    getPositions,
    getEmployeeChecklistLink,
    getWarningById,
    getChecklistList,
    getEmployeeDocumentById,
    getChecklistRecordListByEmployee,
    updateEmployeeAttribute,
    submitNoteToEmployee,
    deleteEmployeeNoteByNoteId,
    updateEmployeePosition,
    createLinkChecklistEmployee,
    submitDocument,
    resignEmployee,
    submitProbationResult
}
