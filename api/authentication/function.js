const {stockDB} = require('./../../database')

const authenticateUser = async ({username, password}) => {
    const user = await stockDB('user').where({username, password}).first()
    if(!user){
        return {status: false, msg: 'Wrong username/password'}
    }
    return {status: true , user}
}

module.exports = {
    authenticateUser
}