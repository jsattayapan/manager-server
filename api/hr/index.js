const express = require('express');
const router = express.Router();
const ft = require('./function')
const helper = require('../helper')
const uniqid = require('uniqid')
const multer = require('multer')
const path = require('path')
const GenPDFTimetable = require('./generatePdfTimetable')

const checkFileType = (file, callback) => {
  const filetypes = /jpeg|jpg|png|gif|pdf/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if(mimetype && extname){
    return callback(null, true)
  }else{
    return callback('Error: Images Only!')
  }
}


const storageEmployeeDocument = multer.diskStorage({
  destination: function(req, file, callback){
    callback(null, './public/storageEmployeeDocument/')
  },
  filename:function(req, file, callback){
    const filename = uniqid()+path.extname(file.originalname);
    req.body.filename = filename;
    callback(null, filename);
  }
})
const uploadEmployeeDocument = multer({
  storage: storageEmployeeDocument,
  limits: {
    fileSize: 1024 *1024 * 5
  },
  fileFilter: function(req, file, callback){
    checkFileType(file, callback);
  }
}).single('imageFile')


router.post('/getEmployeeListForHr', async (req, res) => {
    try{
        const result = await ft.getEmployeeListForHr(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.get('/getDepartments', async (req, res) => {
    try{
        const result = await ft.getDepartments()
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.get('/getPositions', async (req, res) => {
    try{
        const result = await ft.getPositions()
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.post('/getEmployeeNoteListById', async (req, res) => {
    try{
        const result = await ft.getEmployeeNoteListById(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.post('/getLogsByEmployeeId', async (req, res) => {
    try{
        const result = await ft.getLogsByEmployeeId(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.post('/getLeaveById', async (req, res) => {
    try{
        const result = await ft.getLeaveById(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.post('/getEmployeeTimeScanById', async (req, res) => {
    try{
        const result = await ft.getEmployeeTimeScanById(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})


router.post('/getEmployeeChecklistLink', async (req, res) => {
    try{
        const result = await ft.getEmployeeChecklistLink(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.post('/getWarningById', async (req, res) => {
    try{
        const result = await ft.getWarningById(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

router.get('/getChecklistList', async (req, res) => {
    try{
        const result = await ft.getChecklistList()
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})


router.post('/getEmployeeDocumentById', async (req, res) => {
    try{
        const result = await ft.getEmployeeDocumentById(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})


router.post('/getChecklistRecordListByEmployee', async (req, res) => {
    try{
        const result = await ft.getChecklistRecordListByEmployee(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})


router.post('/updateEmployeeAttribute', async (req, res) => {
    try{
        const result = await ft.updateEmployeeAttribute(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})



router.post('/submitNoteToEmployee', async (req, res) => {
    try{
        const result = await ft.submitNoteToEmployee(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})


router.post('/deleteEmployeeNoteByNoteId', async (req, res) => {
    try{
      //body = {id}
        const result = await ft.deleteEmployeeNoteByNoteId(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})


router.post('/downloadTimescanBydepartmentAndMonthWithOT', async (req, res) => {
    try{
      //body = {departmentId, month = new Date()}
        const result = await GenPDFTimetable.downloadTimescanBydepartmentAndMonth(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})


router.post('/submitDocument', async (req, res) => {

  uploadEmployeeDocument(req, res, async (err) => {
    if(err){
      console.log(err);
      res.json({status: false, msg: 'กรุณาอัพโหลดไฟล์ขนาดไม่เกิน 5 MB'})
    }else{
      try{
        //body = {  employeeId, imageFile, name, + filename}
        const result = await ft.submitDocument(req.body)
        res.json(result)
      } catch(e){
        console.log(e);
        res.json({status: false, msg: 'เกิดข้อผิดพลาดขึ้นระหว่างบันทึกข้อมูล'})
      }
    }
  })
})


router.post('/updateEmployeePosition', async (req, res) => {
    try{
      //body = {  username, positionId, employeeId, role, departmentId}
        const result = await ft.updateEmployeePosition(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})


router.post('/createLinkChecklistEmployee', async (req, res) => {
    try{
      //body = {  checklistId, date, employeeId}
        const result = await ft.createLinkChecklistEmployee(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})


router.post('/resignEmployee', async (req, res) => {
    try{
      //body = {  id, username, remark}
        const result = await ft.resignEmployee(req.body)
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})


router.post('/submitProbationResult', async (req, res) => {
    try{
      //body = {  employeeId, level, status, salary, incentive, createBy }
        const result = await ft.submitProbationResult(req.body)
        
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})


router.post('/updateWarningApprove', async (req, res) => {
    try{
      //body = { id, imageFile }
        const result = {}
        res.json(result)
     }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

module.exports = router;
