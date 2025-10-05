const {hrDB} = require('./../../database')
const utilities = require('./../../utilities')
const moment = require('moment')
const helper = require('../helper')

const getEmployeeIdByFingerScan = async ({id, location}) => {
    const found = await hrDB('employee_finger_prints').where({fingerId: id, fingerScanId: location})
    return found.length ? found[0].employeeId : null
}

const createTimescanObject = async ({employeeId}) => {
    const date = moment().format('DD/MM/YYYY')
    const nowTime = moment().format('HH:mm');
    const timeScanList = await hrDB('finger_scan_time').where({id: employeeId, date})
    if(timeScanList.length === 0){
            return {
          status: true,
          object: {
            id: employeeId,
            date,
            time: nowTime,
            type: 'start',
          },
        };
    }
    if(timeScanList.length === 1){
        const minutes = helper.diffMinutes(timeScanList[0].date, timeScanList[0].time)
        if(minutes < 59){
            return { status: false, msg: 'Duplicate!'}
        }
        return {
              status: true,
              object: {
                id: employeeId,
                date,
                time: nowTime,
                type: 'end',
              },
            };
    }
    
    if(timeScanList.length === 2){
        const minutes = helper.diffMinutes(timeScanList[1].date, timeScanList[1].time)
        if(minutes < 30){
            return { status: false, msg: 'Duplicate!'}
        }
        return {
            status: true, 
            object: {
                        id: employeeId,
                        date,
                        time: nowTime,
                        type: 'continue'
                    }
               }
    }
    if(timeScanList.length === 3){
        const minutes = helper.diffMinutes(timeScanList[2].date, timeScanList[2].time)
        if(minutes < 59){
            return { status: false, msg: 'Duplicate!'}
        }
        return {
            status: true, 
            object: {
                        id: employeeId,
                        date,
                        time: nowTime,
                        type: 'end'
                    }
               }
    }
    return { status: false, msg: 'Over Limited!'}
}

const insertTimeObject = async ({obj, employeeId}) => {
    try {
    // ✅ ถ้าเป็นการกลับจากพัก ให้เปลี่ยน type ของการสแกนก่อนหน้าเป็น break
    if (obj.type === 'continue') {
      await hrDB('finger_scan_time')
        .where({ id: employeeId, date: obj.date, type: 'end' })
        .update({ type: 'break' });
    }

    // ✅ แทรกข้อมูลสแกนใหม่
    await hrDB('finger_scan_time').insert(obj);

    return { status: true, msg: `${obj.type} work!` };

  } catch (error) {
    console.error('❌ insertTimeObject Error:', error);
    return { status: false, msg: 'Database insert failed' };
  }
}

const sendTimeScanLineNofify = async (obj, location) => {
    let employee = await hrDB('employee').where({id: obj.id}).first()
    let scan = {
        typeText: 'แสกน: ' + 
        (obj.type === 'start' ? 'เข้างาน' : 
        obj.type === 'continue' ? 'กลับเข้างาน' :  'ออกงาน'),
        date: obj.date,
        time: obj.time,
        location: location == '1' ? 'Avatara' : 'Samed Pavilion',
        timetable: 'ไม่พบข้อมูล',
        type: obj.type
    }
    
    let timetable = await hrDB('employee_timetable').where({employeeId: obj.id, date: obj.date})
    let dateRange = helper.createDateRange(obj.date)
    let leave = await hrDB('employee_leave').where({employeeId: obj.id}).andWhereBetween('startDate', [dateRange.start, dateRange.end])
    
    if(timetable.length !== 0){
        const {dayOff, startTime, breakTime, continueTime, endTime} = timetable[0]
        if(dayOff){
            scan['timetable'] = 'วันหยุดประจำสัปดาห์'
        }
        if(breakTime){
            scan['timetable'] = `${helper.formatHHmm(startTime)} - ${helper.formatHHmm(breakTime)}, ${helper.formatHHmm(continueTime)} - ${helper.formatHHmm(endTime)}`
        }else{
            scan['timetable'] = `${helper.formatHHmm(startTime)} - ${helper.formatHHmm(endTime)}`
        }
    }
    
    if(leave.length !== 0){
        const {type, remark} = leave[0]
        scan['timetable'] = `${type}: ${remark}`
    }
    
    
    await utilities.sendTimeScanLineNofify({employee,scan})
}



module.exports = { getEmployeeIdByFingerScan, insertTimeObject, createTimescanObject,
                 sendTimeScanLineNofify};