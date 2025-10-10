const moment = require('moment');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('../tablepdf');
const {hrDB} = require('./../../database')

const IP = 'http://192.168.100.75:2229';

module.exports.downloadTimescanBydepartmentAndMonth = async ({departmentId, month = new Date()}) => {
  try{
    const payload = await getEmployeeTimeScan({departmentId, month})
    await processTimescanPDF(payload.payload, `${departmentId}-${moment(month).format('MM-YYYY')}.pdf`)
    return { status: true, payload:payload.payload, uri: `${IP}/public/employeeTimetablePDF/${departmentId}-${moment(month).format('MM-YYYY')}.pdf` }
  } catch(e){
    console.log(e);
    return { status: false, msg: 'เกิดข้อผิดพลาดใน Server' }
  }
}


const getEmployeeTimeScan = async ({departmentId, month = new Date()}) => {
  try{
    let employeeList
    const departmentList = await hrDB('department')
    if(departmentId !== ''){
      employeeList = await hrDB('employee').where({departmentId, active: true})
    }else{
      employeeList = await hrDB('employee').where({active: true})
    }
    let payload = []
    for(const emp of employeeList){
      let timescan = await getMonthlyTimeScanByEmployeeId({employeeId: emp.id, inputMonth: month })
      let departmentName = departmentList.find(x => x.id === emp.departmentId)
      if(!departmentName){
        departmentName: 'No Department'
      }else{
        departmentName = departmentName.name
      }
      let obj = {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        defaultDayOff: emp.defaultDayOff,
        departmentName,
        timescan: timescan.payload
      }
      payload = [ ...payload, obj ]
    }
    return {status: true, payload}
  }catch (e) {
    console.log(e);
    return { status: false, msg: 'เกิดข้อผิดพลาดในระบบ Server'}
  }
}

const getMonthlyTimeScanByEmployeeId = async ({employeeId, inputMonth}) => {
  try{
    const date = new moment(inputMonth)
    let startDate = moment(date).subtract(1, 'months').date(21);
    let endDate = moment(date).date(20);
    const days = endDate.diff(startDate, 'days')
    const timeList = await hrDB('finger_scan_time').where({id: employeeId}).andWhere(function() {
    this.whereRaw('STR_TO_DATE(date, "%d/%m/%Y") BETWEEN STR_TO_DATE(?, "%d/%m/%Y") AND STR_TO_DATE(?, "%d/%m/%Y")', [startDate.format('DD/MM/YYYY'), endDate.format('DD/MM/YYYY')]);
  });
    const timetableList = await hrDB('employee_timetable').where({employeeId}).andWhere(function() {
    this.whereRaw('STR_TO_DATE(date, "%d/%m/%Y") BETWEEN STR_TO_DATE(?, "%d/%m/%Y") AND STR_TO_DATE(?, "%d/%m/%Y")', [startDate.format('DD/MM/YYYY'), endDate.format('DD/MM/YYYY')]);
  });
    const leaveList = await hrDB('employee_leave').where({employeeId}).andWhere(function() {
    this.whereRaw('DATE(startDate) BETWEEN STR_TO_DATE(?, "%d/%m/%Y") AND STR_TO_DATE(?, "%d/%m/%Y")', [startDate.format('DD/MM/YYYY'), endDate.format('DD/MM/YYYY')]);
  });

    const ot_timetableList = await hrDB('OT_timetable').where({employeeId}).andWhere(function() {
    this.whereRaw('STR_TO_DATE(date, "%d/%m/%Y") BETWEEN STR_TO_DATE(?, "%d/%m/%Y") AND STR_TO_DATE(?, "%d/%m/%Y")', [startDate.format('DD/MM/YYYY'), endDate.format('DD/MM/YYYY')]);
  });
    let payload = []
    for(let x = 0; x <= days; x++){
      let fingerScan = timeList.filter(y => y.date === moment(startDate).add(x, 'days').format('DD/MM/YYYY'))
      let timetable = timetableList.find(y => y.date === moment(startDate).add(x, 'days').format('DD/MM/YYYY'))
      let ot_timetable = ot_timetableList.find(y => y.date === moment(startDate).add(x, 'days').format('DD/MM/YYYY'))
      let leave = leaveList.find(y => moment(y.startDate).isSame(moment(startDate).add(x, 'days'), 'day'))
      payload = [...payload, {
        date: moment(startDate).add(x, 'days').format('DD/MM/YYYY'),
        start: fingerScan.find(y => y.type === 'start'),
        break: fingerScan.find(y => y.type === 'break'),
        continue: fingerScan.find(y => y.type === 'continue'),
        end: fingerScan.find(y => y.type === 'end'),
        timetable,
        leave,
        ot_timetable
      }]
    }
    return { status: true ,payload: payload }

  }catch (e){
    console.log(e);
    return { status: false, msg: 'เกิดข้อผิดพลาดในระบบ Server'}
  }
}



const processTime = ea => {
  if(ea.leave){
    ea['result'] = 'leave'
    if(ea.leave.type === 'ลาป่วย'){
      ea['sickLeave'] = 1;
    }
    if(ea.leave.type === 'ลา Extra'){
      ea['extraLeave'] = 1;
    }
    if(ea.leave.type === 'ลาพักร้อน'){
      ea['yearlyLeave'] = 1;
    }
    if(ea.leave.type === 'ลากิจ'){
      ea['businessLeave'] = 1;
    }
      ea['remark'] = ea.leave.remark
    return ea
  }

  if(ea.timetable === undefined){
    ea['result'] = 'uncountable'
    return ea
  }


  if(ea.timetable.dayOff){
    //Have Day Off
      if(ea.ot_timetable && ea.start && ea.end){
        const fingerStartTime = moment(ea.start.time, 'hh:mm');
        const fingerEndTime = moment(ea.end.time, 'hh:mm');
        let otStart = moment(moment(ea.ot_timetable.start).format('kk:mm'), 'hh:mm')
        let otEnd = moment(moment(ea.ot_timetable.end).format('kk:mm'), 'hh:mm')

        ea['result'] = 'dayOff+OT'
        ea['remark'] = ea.timetable.dayOff
        ea['countableOTTime'] = calMinsInRange(fingerStartTime, fingerEndTime, otStart, otEnd)

      }else{
        ea['result'] = 'dayOff'
        ea['remark'] = ea.timetable.dayOff

      }
      return ea
  }


  let countableWorkingTime = 0;
  let countableOTTime = 0;
  let workDuration = 0;
  if(!ea.timetable.dayOff){
    let hasStartScan = ea.start ? moment(ea.start.time, 'hh:mm'): null
    let hasBreakScan = ea.break ? moment(ea.break.time, 'hh:mm'): null
    let hasContinueScan = ea.continue ? moment(ea.continue.time, 'hh:mm'): null
    let hasEndScan = ea.end ? moment(ea.end.time, 'hh:mm'): null
    let hasStartTime = ea.timetable.startTime ? moment(moment(ea.timetable.startTime).format('kk:mm'), 'hh:mm'): null
    let hasBreakTime = ea.timetable.breakTime ? moment(moment(ea.timetable.breakTime).format('kk:mm'), 'hh:mm'): null
    let hasContinueTime = ea.timetable.continueTime ? moment(moment(ea.timetable.continueTime).format('kk:mm'), 'hh:mm'): null
    let hasEndTime = ea.timetable.endTime ? moment(moment(ea.timetable.endTime).format('kk:mm'), 'hh:mm'): null
    let hasStartOT = ea.ot_timetable ? moment(moment(ea.ot_timetable.start).format('kk:mm'), 'hh:mm') : null
    let hasEndOT = ea.ot_timetable ? moment(moment(ea.ot_timetable.end).format('kk:mm'), 'hh:mm') : null

    if(hasEndScan && hasStartScan){


      if(hasBreakScan){
        //startScan - breakScan, contiueScan - endScan
        if(hasBreakTime){
          //startTime - BreakTime , continueTime - endTime
          countableWorkingTime += calMinsInRange(hasStartScan, hasBreakScan, hasStartTime, hasBreakTime)
          countableWorkingTime += calMinsInRange(hasStartScan, hasBreakScan, hasContinueTime, hasEndTime)
          countableWorkingTime += calMinsInRange(hasContinueScan, hasEndScan, hasStartTime, hasBreakTime)
          countableWorkingTime += calMinsInRange(hasContinueScan, hasEndScan, hasContinueTime, hasEndTime)
          workDuration += hasBreakTime.diff(hasStartTime, 'minutes');
          workDuration += hasEndTime.diff(hasContinueTime, 'minutes');
        }else{
          //startTime - endTime
          countableWorkingTime += calMinsInRange(hasStartScan, hasBreakScan, hasStartTime, hasEndTime)
          countableWorkingTime += calMinsInRange(hasContinueScan, hasEndScan, hasStartTime, hasEndTime)
          workDuration += hasEndTime.diff(hasStartTime, 'minutes');
        }

        if(ea.ot_timetable){
          countableOTTime += calMinsInRange(hasStartScan, hasBreakScan, hasStartOT, hasEndOT)
          countableOTTime += calMinsInRange(hasContinueScan, hasEndScan, hasStartOT, hasEndOT)
        }
      }else{
        //startScan  endScan
        if(hasBreakTime){
          //startTime - BreakTime , continueTime - endTime
          countableWorkingTime += calMinsInRange(hasStartScan, hasEndScan, hasStartTime, hasBreakTime)
          countableWorkingTime += calMinsInRange(hasStartScan, hasEndScan, hasContinueTime, hasEndTime)
          workDuration += hasBreakTime.diff(hasStartTime, 'minutes');
          workDuration += hasEndTime.diff(hasContinueTime, 'minutes');
        }else{
          //startTime - endTime
          countableWorkingTime += calMinsInRange(hasStartScan, hasEndScan, hasStartTime, hasEndTime)
          workDuration += hasEndTime.diff(hasStartTime, 'minutes');

        }
        if(ea.ot_timetable){
          countableOTTime += calMinsInRange(hasStartScan, hasEndScan, hasStartOT, hasEndOT)
        }
      }


      ea['countableWorkingTime'] = countableWorkingTime
      ea['countableOTTime'] = countableOTTime
      ea['workDuration'] = workDuration
      ea['result'] = countableOTTime ? 'working+OT' : 'working'
      return ea

    }else{
      ea['result'] = 'uncountable'
      return ea
    }
  }
}

const  minutesToDisplay = minutes => {
  if(!minutes){
    return '***'
  }else{
    if(parseInt(minutes/60)){
      return  parseInt(minutes/60) + ' Hr ' + minutes % 60 + ' mins'
    } else {
      return minutes % 60 + ' mins'
    }

  }
}

const minutesToDayDisplay = minutes => {
  let day = parseInt(minutes/(600))
  let dayR = minutes%600
  let hr = parseInt(dayR/60)
  let hrR = dayR%60
  return day + ' Days ' + hr + ' Hr ' + hrR + ' m'
}

const getTotalWorkingHour = (newTimeList, type) => {
  let minutes = newTimeList.reduce((total, ea) => {
    if(ea[type]){
      return total + ea[type]
    }else{
      return total
    }
  }, 0)
  return minutes
}

function calMinsInRange(startScan, endScan, startSchedule, endSchedule) {
      if(startScan == null || endScan == null || startSchedule == null || endSchedule == null){
        return 0;
      }
    // Convert all inputs to moment objects for easier time calculations
    const scanStart = moment(startScan, 'HH:mm');
    const scanEnd = moment(endScan, 'HH:mm');
    const scheduleStart = moment(startSchedule, 'HH:mm');
    const scheduleEnd = moment(endSchedule, 'HH:mm');

    // Check if the scan times are completely outside the schedule
    if (scanEnd.isBefore(scheduleStart) || scanStart.isAfter(scheduleEnd)) {
    return 0; // No overlap between scan times and schedule
    }

    // Adjust scanStart to fit within the schedule range
    const effectiveStart = moment.max(scanStart, scheduleStart);

    // Adjust scanEnd to fit within the schedule range
    const effectiveEnd = moment.min(scanEnd, scheduleEnd);

    // Calculate the difference in minutes between the adjusted times
    const minutesInsideSchedule = effectiveEnd.diff(effectiveStart, 'minutes');

    return minutesInsideSchedule;
}

const setDateAndSumCol = x => {
  let dateCol = ''
  let sumCol = ''
  if(x.result === 'leave'){
    dateCol = x.leave.type
    sumCol = x.remark
    return {dateCol, sumCol}
  }

  if(x.timetable === undefined){
    dateCol = '(-)'
    sumCol = '***'
    return {dateCol, sumCol}
  }

  if(x.result === 'uncountable'){
    dateCol = '(-)'
    sumCol = '***'
  }



  if(x.result === 'dayOff'){
    dateCol = 'วันหยุด'
    sumCol = 'วันหยุดประจำสัปดาห์'
  }
  if(x.result === 'dayOff+OT'){
    dateCol = 'วันหยุด'
    sumCol = 'วันหยุดประจำสัปดาห์\nOT: '+minutesToDisplay(x.countableOTTime)
  }

  if(x.result === 'working' || x.result === 'working+OT'){
    sumCol += 'SW: '+minutesToDisplay(x.countableWorkingTime)
    if(x.workDuration - x.countableWorkingTime > 0){
      sumCol += '\nสาย: '+minutesToDisplay(x.workDuration - x.countableWorkingTime)
    }


  }

  if(x.timetable.startTime !== null){
    if(x.timetable.breakTime === null){
      dateCol = `(${moment(x.timetable.startTime).format('kk:mm')} - ${moment(x.timetable.endTime).format('kk:mm')})`
    }else{
      dateCol = `(${moment(x.timetable.startTime).format('kk:mm')} - ${moment(x.timetable.breakTime).format('kk:mm')},\n${moment(x.timetable.continueTime).format('kk:mm')} - ${moment(x.timetable.endTime).format('kk:mm')})`
    }
    if(x.result === 'uncountable'){
      sumCol = 'ขาดงาน/คำนวนเวลาไม่ได้'
    }
  }

  if(x.ot_timetable){
    dateCol += '\n+OT('+`${moment(x.ot_timetable.start).format('kk:mm')} - ${moment(x.ot_timetable.end).format('kk:mm')}`+')'
  }

  if(x.result === 'working+OT'){
    sumCol += '\n OT: '+minutesToDisplay(x.countableOTTime)
  }

  return {dateCol, sumCol}
  }

const processTimescanPDF = (payload, filename) => {
  try{
      const doc = new PDFDocument({autoFirstPage: false, size: 'A4'});
      var jsonPath = path.join(__dirname,filename);
      // var jsonString = fs.readFileSync(jsonPath, 'utf8');
      doc.pipe(fs.createWriteStream(`public/employeeTimetablePDF/${filename}`));
      payload.forEach((emp, i) => {
      let timescan = emp.timescan.map(ea => processTime(ea))
      let totalWorking = getTotalWorkingHour(timescan, 'countableWorkingTime')
      let totalOT = getTotalWorkingHour(timescan, 'countableOTTime')
      let totalSickLeave = getTotalWorkingHour(timescan, 'sickLeave')
      let totalBusinessLeave = getTotalWorkingHour(timescan, 'businessLeave')
      let totalExtraLeave = getTotalWorkingHour(timescan, 'extraLeave')
      let totalYearlyLeave = getTotalWorkingHour(timescan, 'yearlyLeave')
      let totalLateMins = timescan.reduce((total, x) => {
        if(x.workDuration && x.countableWorkingTime){
          total += (x.workDuration - x.countableWorkingTime)
        }
        return total
      }, 0)

      let totalWeeklyDayOff = timescan.reduce((total, x) => {
        if(x.timetable){
          if(x.timetable.dayOff){
            total += 1
          }
        }
        return total
      }, 0)

      let fullWorkingDay = timescan.length - totalWeeklyDayOff - totalYearlyLeave -totalExtraLeave - totalBusinessLeave - totalSickLeave

      if(totalWorking + totalOT +totalSickLeave + totalExtraLeave +totalYearlyLeave){
        doc.addPage({
        margin: 10})
        doc.font(path.resolve(__dirname, '../../Prompt','Prompt-Medium.ttf')).fontSize(10),

        doc.text(emp.id + ' - ' + emp.name)

        doc.text(emp.role)

        // doc.text('ตารางทำงานเดือน - ' + moment(timescan[0].date, 'DD/MM/YYYY').add(1, 'M').format('MMMM YYYY'))
        doc.text('ตารางทำงานเดือน - ' + moment(timescan[0].date, 'DD/MM/YYYY').add(1, 'M').format('MMMM YYYY'))

        doc.text('รวมชั่วโมงทำงานทั้งหมด - ' + minutesToDayDisplay(totalWorking) + '/' + fullWorkingDay +' วัน')

        doc.text('รวมชั่วโมงทำ OT ทั้งหมด - ' + minutesToDisplay(totalOT))
        doc.text('สาย/ออกก่อนเวลา - ', {continued: true})
        doc.fillColor(totalLateMins? 'red' : 'black').text(totalLateMins, {continued: true})
        doc.fillColor('black')
        doc.text(' นาที')
        const rows = timescan.reduce((payload, x) => {

          let result = setDateAndSumCol(x)

          const date = `${x.date}\n ${result.dateCol}`
          const start = `${x.start ? x.start.time : '-'}`
          const breakT = `${x.break ? x.break.time : '-'}`
          const continueT = `${x.continue ? x.continue.time : '-'}`
          const end = `${x.end ? x.end.time : '-'}`
          const sum = result.sumCol
          return [ ...payload, [date, start, breakT, continueT, end, sum ]]
        }, [])

        const table0 = {
            title: 'Title',
            subtitle: 'Subtitle',
            headers: ['วันที่ (ตารางาน)', 'เข้า', 'พัก', 'กลับเข้า', 'ออก', 'รวมเวลาทำงาน'],
            rows
        };
        const table1 = {
            headers: [ 'ลาป่วย', 'ลากิจ', 'ลา Extra', 'ลาพักร้อน', 'วันหยุดประจำสัปดาห์'],
            rows: [[totalSickLeave + ' วัน', totalBusinessLeave+ ' วัน', totalExtraLeave+ ' วัน', totalYearlyLeave+ ' วัน', totalWeeklyDayOff + ' วัน']]
        };
        doc.moveDown()
        doc.table(table1,{
            prepareHeader: () => {
              doc.font(path.resolve(__dirname, '../../Prompt','Prompt-Medium.ttf')).fontSize(9)
            },
            prepareRow: (row, i) => {

// Move down to the next row
    },
            columnWidths: [ 80, 50, 50, 40, 80],
            // width:550
        });
        doc.moveDown()

        doc.table(table0,{
            prepareHeader: () => doc.font(path.resolve(__dirname, '../../Prompt','Prompt-Light.ttf')),
            prepareRow: (row, i) => doc.font(path.resolve(__dirname, '../../Prompt','Prompt-Medium.ttf')).fontSize(9),
            columnWidths: [ 90, 60, 40, 40, 40, 90],
            // width:550
        });
        doc.removeAllListeners('pageAdded');
      }
    })

    doc.end();
} catch(e){
  console.log(e);
}
}
