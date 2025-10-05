const express = require('express');
const router = express.Router();
const ft = require('./function')

router.post('/', async (req, res) => {
    try{
        const result = await ft.authenticateUser(req.body)
        res.json(result)
    }catch (e){
        console.log(e)
        res.json({status:false, msg: 'Error'})
    }
})

module.exports = router;