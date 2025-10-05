const {hrDB} = require('./../../database')
const helper = require('../helper')
const moment = require('moment')

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
    getEmployeePublicHoliday
    
}