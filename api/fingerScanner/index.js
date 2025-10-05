const express = require('express');
const router = express.Router();
const ft = require('./function')


router.post('/', async (req, res) => {
    try{
        const employeeId = await ft.getEmployeeIdByFingerScan(req.body)
        
        if(!employeeId){
            res.json({status:false, msg: 'Not Found!'})
            return
        }
        
        const timescanObj = await ft.createTimescanObject({employeeId})
        
        if(!timescanObj.status){
            res.json(timescanObj)
            return
        }
        
        const result = await ft.insertTimeObject({obj: timescanObj.object, employeeId})
        
        await ft.sendTimeScanLineNofify(timescanObj.object, req.body.location)
        
        res.json({status: true, employeeId, msg: result.msg })
    }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

module.exports = router;