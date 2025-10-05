const {hrDB, stockDB} = require('./../../database')
const helper = require('../helper')
const moment = require('moment')
const uniqid = require('uniqid')
const utilities = require('../../utilities')

const getLeaveRequestList = async () => {
    const requestList = await hrDB('leave_request').where({status: 'Await'})
    return requestList
}

const getScanRequestList = async () => {
    const requestList = await hrDB('finger_scan_request').where({status: 'Await'})
    return requestList
}
const getTimetableRequestList = async () => {
    const requestList = await hrDB('timetable_request').where({status: 'Await'})
    return requestList
}

const getEmployee = async (id) => {
    const employeeInfo = await hrDB('employee').where({id}).first()
    return employeeInfo
}

const getTimetableByIdAndDate = async (employeeId, date) => {
    const timetable = await hrDB('employee_timetable').where({employeeId, date}).first()
    return timetable
}

const getScanByIdAndDate = async (id, date) => {
    const scanList = await hrDB('finger_scan_time').where({id, date})
    return scanList
}

const getLeaveByIdAndDate = async (id, date) => {
    let dateRange = helper.createDateRange(date)
    let leave = await hrDB('employee_leave').where({employeeId: id}).andWhereBetween('startDate', [dateRange.start, dateRange.end]).first()
    return leave
}

const getOtByIdAndDate = async (id, date) => {
    let ot = await hrDB('OT_timetable').where({employeeId: id, date}).first()
    return ot
}

const hrProcessTimetableRequest = async ({requestId, status}) => {
    if(!status){
        await hrDB('timetable_request').where({id: requestId}).update({status: 'Decline'})
        return {status: true}
    }else{
        const requestInfo = await hrDB('timetable_request').where({id: requestId}).first()
        let { startTime, breakTime, continueTime, endTime, nightShift, employeeId, date } = requestInfo
        await hrDB('timetable_request').where({id: requestId}).update({status: 'Approve'})
        await hrDB('employee_timetable').where({employeeId, date}).del()
        await hrDB('employee_timetable').insert({
            employeeId,
            date,
            startTime,
            breakTime,
            continueTime,
            endTime,
            nightShift
        })
        await hrDB('employee_logs').insert({
            employeeId, 
            detail: `อนุมัติปรับเวลางาน (${date}): ${breakTime ?
            `${helper.formatHHmm(startTime)} - ${helper.formatHHmm(breakTime)}, ${helper.formatHHmm(continueTime)} - ${helper.formatHHmm(endTime)}` :
            `${helper.formatHHmm(startTime)} - ${helper.formatHHmm(endTime)}` 
        }`,
            createBy: 'olotem321',
            timestamp: new Date()
        })
        }
    return {status: true}
    
}

const hrProcessLeaveRequest = async ({requestId, status}) => {
    if(!status){
        await hrDB('leave_request').where({id: requestId}).update({status: 'Decline'})
        return {status: true}
    }else{
        const requestInfo = await hrDB('leave_request').where({id: requestId}).first()
        let { publicHolidayId, type, remark, numberOfDay, nightShift, employeeId, date, createBy } = requestInfo
         let employee = await hrDB('employee').where({id: employeeId}).first()
        
        if(type === 'ลาป่วย'){
            if(employee.remainSickLeaveDay < numberOfDay){
                return { status: false, msg: 'สิทธิการลาไม่เพียงพอ กรุณาตรวจสอบอีกครั้ง'}
            }else{
                let startDate = moment(date, 'DD/MM/YYYY')
                await hrDB('employee').where({id: employeeId}).decrement({remainSickLeaveDay: numberOfDay})
                for(let i = 0; i < numberOfDay; i++){
                    const inputDate = startDate.clone().add(i, 'days')
                    await hrDB('employee_leave').insert({
                        employeeId,
                        startDate: inputDate.format('YYYY-MM-DD HH:mm:ss'),
                        days: 1,
                        remark,
                        createBy,
                        timestamp: new Date(),
                        type,
                        approveBy: 'olotem321'
                    })
                }
            }
        }
        if(type === 'ลาพักร้อน'){
            if(employee.remainYearlyLeaveDay < numberOfDay){
                return { status: false, msg: 'สิทธิการลาไม่เพียงพอ กรุณาตรวจสอบอีกครั้ง'}
            }else{
                await hrDB('employee').where({id: employeeId}).decrement({remainYearlyLeaveDay: numberOfDay})
                let startDate = moment(date, 'DD/MM/YYYY')
                for(let i = 0; i < numberOfDay; i++){
                    const inputDate = startDate.clone().add(i, 'days')
                    await hrDB('employee_leave').insert({
                        employeeId,
                        startDate: inputDate.format('YYYY-MM-DD HH:mm:ss'),
                        days: 1,
                        remark: 'ลาพักร้อน',
                        createBy,
                        timestamp: new Date(),
                        type,
                        approveBy: 'olotem321'
                    })
                }
            }
        }
        if(type === 'ลา Extra'){
            let employeeHoliday = await hrDB('employee_public_holiday').where({emloyeeId, publicHolidayId}).first()
            if(employeeHoliday){
                if(employeeHoliday.status === 'Used'){
                    return { status: false, msg: 'สิทธิวันหยุดนี้ถูกใช้ไปแล้ว กรุณาตรวจสอบอีกครั้ง'}   
                }else{
                    let startDate = moment(date, 'DD/MM/YYYY')
                    const publicHoliday = await hrDB('public_holiday').where({id: publicHolidayId}).first()
                    await hrDB('employee_public_holiday').where({emloyeeId, publicHolidayId}).update({used_date: startDate.format('YYYY-MM-DD HH:mm:ss'), status: 'Used'})
                    await hrDB('employee_leave').insert({
                        employeeId,
                        startDate: startDate.format('YYYY-MM-DD HH:mm:ss'),
                        days: 1,
                        remark: publicHoliday.name,
                        createBy,
                        timestamp: new Date(),
                        type,
                        approveBy: 'olotem321'
                    })
                }
            }else{
                return { status: false, msg: 'ไม่พบสิทธิวันหยุดนี้'}   
            }
        }
        
        await hrDB('leave_request').where({id: requestId}).update({status: 'Approve'})
        await hrDB('employee_timetable').where({employeeId, date}).del()
        
        await hrDB('employee_logs').insert({
            employeeId, 
            detail: `อนุมัติ ${type} (${date}): ${remark}`,
            createBy: 'olotem321',
            timestamp: new Date()
        })
        }
    return {status: true}
    
}

const getEmployeeLeaveByEmployeeId = async ({employeeId}) => {
    const leaveList = await hrDB('employee_leave').where({employeeId})
    return { status: true, leaveList}
}

const getLeaveRequestByEmployeeId = async ({employeeId}) => {
    const leaveRequestList = await hrDB('leave_request').where({employeeId})
    return { status: true, leaveRequestList}
}

const getEmployeePublicHoliday = async ({employeeId}) => {
    const employeePublicHolidayList = await hrDB('employee_public_holiday').leftJoin('public_holiday', 'public_holiday.id', 'employee_public_holiday.publicHolidayId').select('employee_public_holiday.*', 'public_holiday.name').where('employee_public_holiday.employeeId', employeeId)
    return { status: true, employeePublicHolidayList}
}


const getPublicHolidayList = async () => {
    const publicHolidayList = await hrDB('public_holiday')
    return { status: true, publicHolidayList }
}

const hrProcessTimeScanRequest = async ({ requestId, status }) => {
     if(!status){
        await hrDB('finger_scan_request').where({id: requestId}).update({status: 'Decline'})
        return {status: true}
    }else{
        const requestInfo = await hrDB('finger_scan_request').where({id: requestId}).first()
        let { time, remark, type, employeeId, date } = requestInfo
        await hrDB('finger_scan_request').where({id: requestId}).update({status: 'Approve'})
        
        const timeScanList = await hrDB('finger_scan_time').where({id: employeeId, date})
        const length = timeScanList.length
         if(length > 3 ){
                await hrDB('finger_scan_request').where({id: requestId}).update({status: 'Decline'})
                return { status: false, msg: 'ลายนิ้วมือเต็ม ไม่สามารถเพ่ิมได้'}
            }
        
        
        
        const insertScan = async () => {
             await hrDB('finger_scan_time')
                    .insert({
                        id: employeeId, date, time, type
                    }) 
        }
        
        const updateType = async (oldType, newType) => {
          await hrDB('finger_scan_time')
            .where({ id: employeeId, date, type: oldType })
            .update({ type: newType });
        };
        
       // ✅ START
    if (type === 'start') {
      if (length === 0) await insertScan();
      else if (length === 1) {
        await updateType('start', 'end');
        await insertScan();
      } else if (length === 2) {
        await updateType('end', 'continue');
        await updateType('start', 'break');
        await insertScan();
      } else if (length === 3) {
        await updateType('continue', 'end');
        await updateType('break', 'continue');
        await updateType('start', 'break');
        await insertScan();
      }
    }

    // ✅ BREAK
    if (type === 'break') {
      if (length <= 1) await insertScan();
      else if (length === 2) {
        await updateType('end', 'continue');
        await insertScan();
      } else if (length === 3) {
        await updateType('continue', 'end');
        await updateType('break', 'continue');
        await insertScan();
      }
    }

    // ✅ CONTINUE
    if (type === 'continue') {
      if (length <= 1) await insertScan();
      else if (length === 2) {
        await updateType('end', 'break');
        await insertScan();
      } else if (length === 3) {
        await updateType('continue', 'end');
        await insertScan();
      }
    }

    // ✅ END
    if (type === 'end') {
      await insertScan();
    }
        
        
        
        await hrDB('employee_logs').insert({
            employeeId, 
            detail: `อนุมัติแก้แสกนนิ้ว ${type} ${date} - ${time} : ${remark}`,
            createBy: 'olotem321',
            timestamp: new Date()
        })
        }
    return {status: true}
}

const getEmployeeTimetableByDateByDepartmentId = async ({departmentId, date}) => {
    
}

const getEmployeeListByDepartmentId = async (departmentId) => {
    const result = await hrDB('employee').where({departmentId, active: true})
    return result
}


const getMonthlyTimeScanByEmployeeId = async ({employeeId, date}) => {
   const base = moment(date, 'DD/MM/YYYY');
  const end = base.clone().date(20);
  const start = base.clone().subtract(1, 'month').date(21);

  // ✅ ดึงข้อมูลทั้งหมดช่วงนั้นทีเดียว
  const timeScanListAll = await hrDB('finger_scan_time')
  .where('id', employeeId)
  .andWhereRaw(
    `STR_TO_DATE(date, '%d/%m/%Y') BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y')`,
    [start.format('DD/MM/YYYY'), end.format('DD/MM/YYYY')]
  );

  const timetableList = await hrDB('employee_timetable')
  .where('employeeId', employeeId)
  .andWhereRaw(
    `STR_TO_DATE(date, '%d/%m/%Y') BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y')`,
    [start.format('DD/MM/YYYY'), end.format('DD/MM/YYYY')]
  );

  const leaveList = await hrDB('employee_leave')
    .where('employeeId', employeeId)
    .andWhereBetween('startDate', [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]);

  // ✅ วนลูปแค่วันที่
  const dates = [];
  const cur = start.clone();
  while (cur.isSameOrBefore(end, 'day')) {
    dates.push(cur.format('DD/MM/YYYY'));
    cur.add(1, 'day');
  }

  const result = dates.map((d) => {
    const scanList = timeScanListAll.filter((x) => x.date === d);
    const timetable = timetableList.find((x) => x.date === d);
    const dateRange = helper.createDateRange(d);
    const leave = leaveList.find(
      (x) =>
        moment(x.startDate).isSame(moment(d, 'DD/MM/YYYY'), 'day')
    );

    return {
      date: d,
      start: (scanList.find((x) => x.type === 'start') || {}).time || '-',
      break: (scanList.find((x) => x.type === 'break') || {}).time || '-',
      continue: (scanList.find((x) => x.type === 'continue') || {}).time || '-',
      end: (scanList.find((x) => x.type === 'end') || {}).time || '-',
      startTime: timetable ? timetable.startTime : '',
      breakTime: timetable ? timetable.breakTime : '',
      continueTime: timetable ? timetable.continueTime : '',
      endTime: timetable ? timetable.endTime : '',
      remark: timetable
        ? timetable.dayOff
        : leave
        ? leave.remark
        : '',
      leaveType: leave ? leave.type : '',
      nightShift: timetable ? timetable.nightShift : null,
    };
  });

  return result;
}

const submitTimeScanRequest = async ({employeeId, date, type, time, remark, createBy}) => {
    const foundAwaitRequest = await hrDB('finger_scan_request').where({employeeId, date, type, status: 'Await'}).first()
    if(foundAwaitRequest){
        return {status: false, msg: 'มีรายการที่ขอที่เหมือนกัน รออนุมัติอยู่ กรุณาลองใหม่อีกครั้ง'}
    }else{
        await hrDB('finger_scan_request').insert({id: uniqid(), employeeId, date, time, type, remark, status: 'Await', createAt: new Date(), createBy})
        return { status: true}
    }
}

const submitLeaveRequest = async ({employeeId, date, type, numberOfDay, remark, createBy, publicHolidayId}) => {
    const foundAwaitRequest = await hrDB('leave_request').where({employeeId, date, status: 'Await'}).first()
    if(foundAwaitRequest){
        return {status: false, msg: 'มีรายการที่ขอที่ในวันทีเลือก รออนุมัติอยู่ กรุณาลองใหม่อีกครั้ง'}
    }else{
        if(type === 'ลา Extra'){
            let publicHoliday = await hrDB('public_holiday').where({id: publicHolidayId}).first()
            remark = publicHoliday.name
        }
        await hrDB('leave_request').insert({id: uniqid(), employeeId, date, publicHolidayId, numberOfDay, type, remark, status: 'Await', createAt: new Date(), createBy})
        return { status: true}
    }
}


const submitTimetableRequest = async ({employeeId, date, startTime, breakTime,continueTime, endTime,nightShift, remark, createBy}) => {
    const foundAwaitRequest = await hrDB('timetable_request').where({employeeId, date, status: 'Await'}).first()
    if(foundAwaitRequest){
        return {status: false, msg: 'มีรายการที่ขอที่ในวันทีเลือก รออนุมัติอยู่ กรุณาลองใหม่อีกครั้ง'}
    }else{
        await hrDB('timetable_request').insert({id: uniqid(), employeeId, date, startTime, breakTime,continueTime, endTime,nightShift, remark, status: 'Await', createAt: new Date(), createBy})
        return { status: true}
    }
}


const deleteEmployeeTimetable = async ({employeeId, date}) => {
   await hrDB('employee_timetable').where({employeeId, date}).del()
    return { status: true }
}


const submitOTByManager = async ({employeeId, date, startTime, endTime, remark, createBy}) => {
   const foundOT = await hrDB('OT_timetable').where({employeeId, date}).first()
   if(foundOT){
       return {status: false, msg: 'ไม่สามารถใส่รายการซ้ำได้ กรุณาติดต่อ HR'}
   }else{
       await hrDB('OT_timetable').insert({employeeId, date, start: startTime, end: endTime, remark, status: 'approve'})
       return { status: true }
   }
}

const sendOTNotifyToLine = async ({employeeId, date, startTime, endTime, remark, createBy}) => {
    let employee = await hrDB('employee').where({id: employeeId}).first()
    let timetable = await hrDB('employee_timetable').where({employeeId, date}).first()
    let userInfo = await stockDB('user').where({username: createBy}).first()
    if(timetable){
        const {dayOff, startTime, breakTime, continueTime, endTime} = timetable
        if(dayOff){
            timetable = 'วันหยุดประจำสัปดาห์'
        }
        if(breakTime){
            timetable = `${helper.formatHHmm(startTime)} - ${helper.formatHHmm(breakTime)}, ${helper.formatHHmm(continueTime)} - ${helper.formatHHmm(endTime)}`
        }else{
            timetable = `${helper.formatHHmm(startTime)} - ${helper.formatHHmm(endTime)}`
        }
    }else{
        timetable = '-'
    }
    const obj = {
        date,
        ot_time: `${moment(startTime).format('HH:mm')} - ${moment(endTime).format('HH:mm')}`,
        createBy: userInfo.short_name,
        name: employee.name,
        role: employee.role,
        imageUrl: employee.imageUrl,
        timetable,
        remark
    }
    await utilities.sendOTLineNofify(obj)
}

const submitEmployeeTimetable = async ({employeeId, date, startTime, breakTime, continueTime, endTime, nightShift}) => {
    await hrDB('employee_timetable').where({employeeId, date}).del()
    await hrDB('employee_timetable').insert({employeeId, date, startTime, breakTime, continueTime, endTime, nightShift})
    return {status: true}
}

module.exports = {
    getLeaveRequestList,
    getScanRequestList,
    getTimetableRequestList,
    getEmployee,
    getTimetableByIdAndDate,
    getScanByIdAndDate,
    getLeaveByIdAndDate,
    getOtByIdAndDate,
    getOtByIdAndDate,
    hrProcessTimetableRequest,
    hrProcessLeaveRequest,
    getEmployeeLeaveByEmployeeId,
    getLeaveRequestByEmployeeId,
    getEmployeePublicHoliday,
    getPublicHolidayList,
    hrProcessTimeScanRequest,
    getEmployeeListByDepartmentId,
    getMonthlyTimeScanByEmployeeId,
    submitTimeScanRequest,
    submitLeaveRequest,
    submitTimetableRequest,
    deleteEmployeeTimetable,
    submitOTByManager,
    sendOTNotifyToLine,
    submitEmployeeTimetable
    
}