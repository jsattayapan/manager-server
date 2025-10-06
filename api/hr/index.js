const express = require('express');
const router = express.Router();
const ft = require('./function')
const helper = require('../helper')


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

module.exports = router;