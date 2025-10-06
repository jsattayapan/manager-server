const {stockDB, hrDB} = require('./../../database')

const authenticateUser = async ({username, password}) => {
    let user = await stockDB('user').where({username, password}).first()
    const permissionList = await stockDB('user_permission').where({username})
    user['permissionList'] = permissionList.map(x => x.permission)
    if(!user){
        return {status: false, msg: 'Wrong username/password'}
    }
    return {status: true , data: user}
}

const getUserInfo = async ({username}) => {
    let user = await stockDB('user').select('username', 'first_name', 'last_name', 'short_name', 'position', 'imageUrl', 'employeeId as id').where({username}).first()
    if(!user){
        user = await hrDB('employee').select('id', 'name as first_name', 'role as position', 'imageUrl').where({id: username}).first()
    }
    return user
}

module.exports = {
    authenticateUser,
    getUserInfo
}