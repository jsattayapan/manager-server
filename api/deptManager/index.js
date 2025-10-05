const express = require('express');
const router = express.Router();
const ft = require('./function')
const helper = require('../helper')

router.get('/getEmployeeUnapproveRequest', async (req, res) => {
    try{
        const leaveRequestList = await ft.getLeaveRequestList()
        const scanRequestList = await ft.getScanRequestList()
        const timetableRequestList = await ft.getTimetableRequestList()
        
        let dateList = [...leaveRequestList, ...scanRequestList, ...timetableRequestList].map(item => item.date)
        dateList = Array.from(new Set(dateList))
        
        let employeeList = [...leaveRequestList, ...scanRequestList, ...timetableRequestList].map(item => item.employeeId)
        employeeList = Array.from(new Set(employeeList))
        let resultList = []
        
        // ✅ ดึงข้อมูลพนักงานทั้งหมดทีเดียว (ลด query ซ้ำ)
        const allEmployees = {};
        for (const id of employeeList) {
          allEmployees[id] = await ft.getEmployee(id);
        }
        
        for(const id of employeeList){
            const employeeInfo = allEmployees[id];
            for(const date of dateList){
                
                const timetable = await ft.getTimetableByIdAndDate(id, date)
                const scanList = await ft.getScanByIdAndDate(id, date)
                const ot_timetable = await ft.getOtByIdAndDate(id,date)
                const dayOffList = await ft.getLeaveByIdAndDate(id, date)
                let obj = {
                    name: employeeInfo.name,
                    role: employeeInfo.role,
                    date,
                    imageUrl: employeeInfo.imageUrl,
                    startTime: timetable ? timetable.startTime : '',
                    breakTime: timetable ? timetable.breakTime : '', 
                    continueTime: timetable ? timetable.continueTime : '',
                    endTime: timetable ? timetable.endTime : '',
                    nightShift: timetable ? timetable.nightShift: 0,
                    dayOff: timetable ?  timetable.dayOff ? true : false : false,
                    weeklyDayOff: timetable ? timetable.dayOff ? true : false : false,
                    startScan: scanList.find(x => x.type === 'start'),
                    breakScan: scanList.find(x => x.type === 'break'),
                    continueScan: scanList.find(x => x.type === 'continue'),
                    endScan: scanList.find(x => x.type === 'end'),
                    dayOffType: dayOffList ? dayOffList.type : '',
                    timetableRequestList: timetableRequestList.filter(x => (x.employeeId === id && x.date === date)),
                    leaveRequestList: leaveRequestList.filter(x => (x.employeeId === id && x.date === date)),
                    timeScanRequestList: scanRequestList.filter(x => (x.employeeId === id && x.date === date)),
                    ot_timetable: ot_timetable ? `${helper.formatHHmm(ot_timetable.start)} - ${helper.formatHHmm(ot_timetable.end)}` : ''
                }
                if(!(obj.timetableRequestList.length === 0 && obj.leaveRequestList.length === 0 && obj.timeScanRequestList.length === 0)){
                    resultList = [...resultList, obj]
                }
                
            }
        }
         
        res.json({ status: true, employeeList: resultList , dateList })
    }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.post('/hrProcessTimetableRequest', async (req, res) => {
    try{
        const result = await ft.hrProcessTimetableRequest(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.post('/hrProcessLeaveRequest', async (req, res) => {
    try{
        const result = await ft.hrProcessLeaveRequest(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.post('/getEmployeeLeaveByEmployeeIdMonth', async (req, res) => {
    try{
        res.json({status: true, leaveList: []})
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.post('/getEmployeeLeaveByEmployeeId', async (req, res) => {
    try{
        const result = await ft.getEmployeeLeaveByEmployeeId(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.post('/getLeaveRequestByEmployeeId', async (req, res) => {
    try{
        const result = await ft.getLeaveRequestByEmployeeId(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.post('/getEmployeePublicHoliday', async (req, res) => {
    try{
        const result = await ft.getEmployeePublicHoliday(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

module.exports = router;