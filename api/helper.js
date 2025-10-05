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

module.exports = {
    diffMinutes,
    createDateRange,
    formatHHmm
}