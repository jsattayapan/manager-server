const request = require('request')

const tayLine = 'U9fe2a1b7a904b81702745cd749424de5'


const sendTimeScanLineNofify = ({employee, scan}) => {
    
    const payload2 = {
  type: "flex",
  altText: `${employee.name} ${scan.typeText} ${scan.time}`,
  contents: {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "box",
              layout: "vertical",
              flex: 1,
              contents: [
                {
      "type": "image",
      "url": "https://tunit3-samed.ap.ngrok.io/public/employee/"+ employee.imageUrl,
      "size": "full",
      "aspectRatio": "1:1",
      "aspectMode": "cover"
    }
              ]
            },
            {
              type: "box",
              layout: "vertical",
              flex: 1,
              contents: [
                {
                  type: "text",
                  text: `${scan.type === 'end' ? '🌞' : '✅'} ${scan.typeText}`,
                  weight: "bold",
                  size: "md",
                  wrap: true,
                    "margin": "md",
                },
                {
                  type: "text",
                  text: `📅 ${scan.date}`,
                  size: "sm",
                  color: "#555555",
                    "margin": "md",
                },
                {
                  type: "text",
                  text: `🕒 ${scan.time}`,
                  size: "sm",
                  color: "#555555",
                    "margin": "md",
                },
                {
                  type: "text",
                  text: `🏢 ${scan.location}`,
                  size: "sm",
                  color: "#111111",
                    "margin": "md",
                }
              ]
            }
          ]
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `👩‍ ${employee.name}`,
              size: "sm",
              color: "#111111",
              wrap: true
            },
            {
              type: "text",
              text: `⭐ ${employee.role}`,
              size: "sm",
              color: "#111111"
            },
            {
              type: "text",
              text: `⏰ ${scan.timetable}`,
              size: "sm",
              color: "#d32f2f"
            }
          ]
        }
      ]
    }
  }
};
    
    sendFlexToLine({payload: payload2, to: tayLine})
}

const sendOTLineNofify = (data) => {
    const payload = {
  type: "flex",
  altText: `${data.name} เพิ่ม OT`,
  contents: {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "box",
              layout: "vertical",
              flex: 1,
              contents: [
                {
      "type": "image",
      "url": "https://tunit3-samed.ap.ngrok.io/public/employee/"+ data.imageUrl,
      "size": "full",
      "aspectRatio": "1:1",
      "aspectMode": "cover"
    }
              ]
            },
            {
              type: "box",
              layout: "vertical",
              flex: 1,
              contents: [
                {
                  type: "text",
                  text: `✅ OT By Manager`,
                  weight: "bold",
                  size: "md",
                  wrap: true,
                    "margin": "md",
                },
                {
                  type: "text",
                  text: `📅 ${data.date}`,
                  size: "sm",
                  color: "#555555",
                    "margin": "md",
                },
                {
                  type: "text",
                  text: `🕒 ${data.ot_time}`,
                  size: "sm",
                  color: "#555555",
                    "margin": "md",
                },
                {
                  type: "text",
                  text: `✍️ ${data.createBy}`,
                  size: "sm",
                  color: "#111111",
                    "margin": "md",
                }
              ]
            }
          ]
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `👩‍ ${data.name}`,
              size: "sm",
              color: "#111111",
              wrap: true
            },
            {
              type: "text",
              text: `⭐ ${data.role}`,
              size: "sm",
              color: "#111111"
            },
            {
              type: "text",
              text: `⏰ ${data.timetable}`,
              size: "sm",
              color: "#d32f2f"
            },
              {
          type: "separator",
          margin: "md"
        },
              {
              type: "text",
              text: `⚠️ ${data.remark}`,
              size: "sm",
              color: "#d32f2f"
            }
          ]
        }
      ]
    }
  }
};
    sendFlexToLine({payload, to: tayLine})
}


const sendFlexToLine = ({
  payload,
  to
}) => {
  let headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer {4wH6/mM8lVGhLNl0F3JICYFOwEoynsZU+yjPpliA+OtULNbed+Wlfzc4nLJNDSXxeTlC6646xXVSG+GVv67olzLoMZZh/MrmJEIqsWHw3WA4kwdEwmc7ai5Hxvd2ua1PUJ/EQ0LNDiA9nsqM1WSmagdB04t89/1O/w1cDnyilFU=}'
  }
  let body = JSON.stringify({
    to,
    messages: [payload]
  })
  request.post({
    url: 'https://api.line.me/v2/bot/message/push',
    headers: headers,
    body: body
  }, (err, res, body) => {
    if(res.statusCode === undefined){
      console.log('status = undefined');
    }else{
      console.log('status = ' + res.statusCode);
      console.log(err);
    }
  });
}

module.exports = {
    sendTimeScanLineNofify,
    sendOTLineNofify
}