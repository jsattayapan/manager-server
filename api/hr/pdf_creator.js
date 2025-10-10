const PDFDocument = require('../tablepdf');
const fs = require('fs');
const path = require('path');
const helper = require('../helper')

function createEmployeeTimetablePDF(employeeList, filename, monthText) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const outputPath = path.join(__dirname, '../../public/employeeTimetablePDF/' + filename + '.pdf');
  doc.pipe(fs.createWriteStream(outputPath));

    
    for(const emp of employeeList){
        const totalWorking = emp.timescan.reduce((total, time) => total += time.countableWorkingTime , 0)
        const totalOT = emp.timescan.reduce((total, time) => total += time.countableOTTime , 0)
        let leaveDayOff = emp.timescan.map(time => ["dayOff", "leave", "dayOff+OT"].includes(time.result))
        const {timescan} = emp
        console.log(leaveDayOff)
        
        doc.addPage();
        
        doc.font(path.resolve(__dirname, 'Prompt','Prompt-Medium.ttf'))
     doc.text(emp.id + ' - ' + emp.name)
     doc.font(path.resolve(__dirname, 'Prompt','Prompt-Medium.ttf'))
     doc.text(emp.role)
     doc.font(path.resolve(__dirname, 'Prompt','Prompt-Medium.ttf'))
     doc.text('ตารางทำงานเดือน - ' + moment(timescan[0].date, 'DD/MM/YYYY').add(1, 'M').format('MMMM YYYY'))
     console.log(timescan[0]);
    doc.font(path.resolve(__dirname, 'Prompt','Prompt-Medium.ttf'))
    doc.text('รวมชั่วโมงทำงานทั้งหมด - ' + minutesToDisplay(totalWorking))
    doc.font(path.resolve(__dirname, 'Prompt','Prompt-Medium.ttf'))
    doc.text('รวมชั่วโมงทำ OT ทั้งหมด - ' + minutesToDisplay(totalOT))
        
        
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
        headers: ['รวมชั่วโมงทำงาน', 'รวมชั่วโมง OT', 'สาย/ออกก่อนเวลา' , 'ลาป่วย', 'ลากิจ', 'ลา Extra', 'ลาพักร้อน', 'วันหยุดประจำสัปดาห์'],
        rows: [[minutesToDisplay(totalWorking), minutesToDisplay(totalOT), totalLateMins +' นาที', totalSickLeave + ' วัน', totalBusinessLeave+ ' วัน', totalExtraLeave+ ' วัน', totalYearlyLeave+ ' วัน', totalWeeklyDayOff + ' วัน']]
    };
        
        
         const headers = ['ลาป่วย', 'ลากิจ', 'ลา Extra', 'ลาพักร้อน', 'วันหยุดประจำสัปดาห์'];
//    const rows = [
//      [
//          leaveDayOff.filter(x => (x.result === 'leave' && (x.leave ||{}).type === 'ลาป่วย')).length, 
//          leaveDayOff.filter(x => (x.result === 'leave' && (x.leave ||{}).type === 'ลากิจ')).length, 
//          leaveDayOff.filter(x => (x.result === 'leave' && (x.leave ||{}).type === 'ลา Extra')).length, 
//          leaveDayOff.filter(x => (x.result === 'leave' && (x.leave ||{}).type === 'ลาพักร้อน')).length, 
//          leaveDayOff.filter(x => (x.result === 'dayOff' || x.result === 'dayOff+OT')).length
//      ]
//    ];
    
    drawTable(doc, headers, rows, 50, 100, {
  colWidths: [80, 80, 80, 80, 80],
  rowHeight: 25
});
        
    }
    
    
  // ---------------- HEADER ----------------
//  doc
//    .fontSize(20)
//    .font('Helvetica-Bold')
//    .text('Avatara Resort', { align: 'center' });
//
//  doc
//    .fontSize(14)
//    .font('Helvetica')
//    .text('Employee Salary Summary', { align: 'center' });
//
//  doc
//    .fontSize(12)
//    .text('Payroll Period: 21 Sep – 20 Oct 2025', { align: 'center' });
//
//  doc.moveDown(1.5);
//
//  // ---------------- TABLE DATA ----------------
//  const table = {
//    title: 'รายงานสรุปเงินเดือนพนักงานประจำเดือนตุลาคม 2025',
//    headers: [
//      { label: 'ลำดับ', property: 'no', width: 40 },
//      { label: 'ชื่อ - สกุล', property: 'name', width: 120 },
//      { label: 'ตำแหน่ง', property: 'position', width: 100 },
//      { label: 'แผนก', property: 'department', width: 80 },
//      { label: 'วันทำงาน', property: 'days', width: 60, align: 'center' },
//      { label: 'เงินเดือน (บาท)', property: 'salary', width: 90, align: 'right' },
//      { label: 'หักขาด / ลา / สาย', property: 'deduct', width: 80, align: 'right' },
//      { label: 'รับสุทธิ (บาท)', property: 'net', width: 90, align: 'right' },
//    ],
//    datas: [
//      { no: 1, name: 'สมชาย ใจดี', position: 'พนักงานต้อนรับ', department: 'Front', days: 26, salary: '15,000', deduct: '500', net: '14,500' },
//      { no: 2, name: 'สุดา พูนสุข', position: 'แม่บ้าน', department: 'Housekeeping', days: 25, salary: '14,000', deduct: '0', net: '14,000' },
//      { no: 3, name: 'อนันต์ ทองแท้', position: 'พนักงานเสิร์ฟ', department: 'F&B', days: 27, salary: '15,500', deduct: '200', net: '15,300' },
//      { no: 4, name: 'วราภรณ์ นุ่มนวล', position: 'แคชเชียร์', department: 'Bar', days: 26, salary: '16,000', deduct: '0', net: '16,000' },
//    ],
//  };
//
//  // ---------------- TABLE ----------------
//  doc.table(table, {
//    prepareHeader: () => doc.font('Helvetica-Bold').fontSize(11),
//    prepareRow: (row, i) => doc.font('Helvetica').fontSize(10),
//    divider: {
//      header: { disabled: false, width: 1, opacity: 0.5 },
//      horizontal: { disabled: false, width: 0.5, opacity: 0.3 },
//    },
//  });
//
//  // ---------------- SUMMARY ----------------
//  doc.moveDown(1);
//  doc
//    .font('Helvetica-Bold')
//    .fontSize(12)
//    .text('รวมพนักงานทั้งหมด: 4 คน', { align: 'right' });
//
//  doc
//    .font('Helvetica-Bold')
//    .fontSize(12)
//    .text('รวมยอดสุทธิทั้งหมด: 59,800 บาท', { align: 'right' });
//
//  doc.moveDown(2);
//
//  // ---------------- SIGNATURE AREA ----------------
//  const sigY = doc.y;
//  const sigSpace = 180;
//  doc
//    .font('Helvetica')
//    .fontSize(11)
//    .text('ลงชื่อ ____________________________', 60, sigY + 20)
//    .text('(ฝ่ายบุคคล)', 100, sigY + 40);
//
//  doc
//    .text('ลงชื่อ ____________________________', 230, sigY + 20)
//    .text('(ผู้จัดการทั่วไป)', 280, sigY + 40);
//
//  doc
//    .text('ลงชื่อ ____________________________', 400, sigY + 20)
//    .text('(เจ้าของกิจการ)', 450, sigY + 40);
//
//  doc.moveDown(2);
//  doc.fontSize(10).text('เอกสารนี้สร้างขึ้นเมื่อ: ' + new Date().toLocaleString('th-TH'), { align: 'right' });

  doc.end();
  console.log(`✅ PDF created successfully: ${output}`);
    return { status: true }
}







module.exports = {
    createEmployeeTimetablePDF
}

