const moment = require('moment')
function diffMinutes(dateStr, timeStr) {
  // รวม date + time เป็น moment เดียว
  const inputDateTime = moment(`${dateStr} ${timeStr}`, 'DD/MM/YYYY HH:mm');
  const now = moment();

  // คำนวณต่างกันเป็นนาที (ผลลัพธ์อาจติดลบถ้า input อยู่ในอนาคต)
  return now.diff(inputDateTime, 'minutes');
}

function createDateRange(dateInput) {
    const start = moment(dateInput, 'DD/MM/YYYY').startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const end = moment(dateInput, 'DD/MM/YYYY').endOf('day').format('YYYY-MM-DD HH:mm:ss');
    return {start, end}
}

function formatHHmm(time){
    return moment(time).format('HH:mm')
}


function getMinutesBetween(timeIn, timeOut) {
  const format = 'HH:mm';
  const start = moment(timeIn, format);
  const end = moment(timeOut, format);

  // ✅ กรณีข้ามวัน เช่น 22:00 - 02:00
  if (end.isBefore(start)) {
    end.add(1, 'day');
  }

  return end.diff(start, 'minutes');
}

/**
 * คำนวณจำนวนนาทีที่อยู่ภายในกรอบเวลาตารางงานเท่านั้น
 * เช่น พนักงานแสกนเข้า 07:50 – ออก 17:30 แต่เวลางานคือ 08:00 – 17:00
 * จะนับเฉพาะ 08:00–17:00 = 540 นาที
 */
function calcScanMinutesWithinSchedule(scanIn, scanOut, scheduleIn, scheduleOut) {
  const format = 'HH:mm';

  const sIn = moment(scanIn, format);
  const sOut = moment(scanOut, format);
  const schIn = moment(scheduleIn, format);
  const schOut = moment(scheduleOut, format);

  // ✅ ตัดเวลานอกช่วงทิ้ง
  const effectiveIn = moment.max(sIn, schIn);
  const effectiveOut = moment.min(sOut, schOut);

  // ถ้าออกก่อนเข้า → ไม่มีเวลาทำงาน
  if (effectiveOut.isBefore(effectiveIn)) return 0;

  return effectiveOut.diff(effectiveIn, 'minutes');
}


module.exports = {
    diffMinutes,
    createDateRange,
    formatHHmm,
    calcScanMinutesWithinSchedule,
    getMinutesBetween
}