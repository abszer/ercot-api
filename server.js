const express = require('express');
const fsPromises = require('fs/promises');
const fs = require('fs');
const path = require('path');
const requests = require('simple-requests');
const JSSoup = require('jssoup').default;
const { TwitterApi } = require('twitter-api-v2');
const dotenv = require('dotenv');
const app = express();
dotenv.config();


const PORT = process.env.PORT || 3000;
const client = new TwitterApi({
     appKey: process.env.CONSUMER_APP_KEY,
     appSecret: process.env.CONSUMER_APP_SECRET,
     accessToken: process.env.ACCESS_TOKEN_KEY,
     accessSecret: process.env.ACCESS_TOKEN_SECRET
});

const rtSystemConditions = {
     "Current Frequency": 0,
     "Instantaneous Time Error": 0,
     "BAAL Exceedances": 0,
     "Actual System Demand": 0,
     "Total System Capacity": 0,
     "Total Wind Output": 0,
     "Total PVGR Output": 0,
     "Current System Inertia": 0,
     "DC_E": 0,
     "DC_L": 0,
     "DC_N": 0,
     "DC_R": 0,
     "DC_S": 0,
     "Last Update": 0
}

// FUNCTIONS

const getRTData = () => {
     // event tracking variables 
     let extremeEvents = [];
     
     // data scraper
     requests.get("https://www.ercot.com/content/cdr/html/real_time_system_conditions.html")
     .then((response) => {
          
          let soup = new JSSoup(response.data);      
          let currentData = soup.findAll('td', 'labelClassCenter');
          let lastUpdate = soup.find('div', 'schedTime');
          let objKeys = Object.keys(rtSystemConditions);
          
          for (let i = 0; i < currentData.length; i++){
               rtSystemConditions[objKeys[i]] = parseFloat(currentData[i].text);
          }
          rtSystemConditions["Last Update"] = lastUpdate.text.slice(14, lastUpdate.text.length);
     

          // check to see if grid frequency is less than or greater than what is acceptable
          if (rtSystemConditions['Current Frequency'] < 59.95 || rtSystemConditions['Current Frequency'] > 60.05){
               client.v2.tweet('Grid Status: Warning ⚠️\n-- Extreme Frequency Event Detected --\nTrigger Frequency: ' + rtSystemConditions['Current Frequency'] + " Hz" + "\n" + "Current Demand/Total Demand: " + rtSystemConditions['Actual System Demand'] + "/" + rtSystemConditions['Total System Capacity'])
               console.log('tweeted alert')
               extremeEvents.push(rtSystemConditions['Last Update'].slice(rtSystemConditions['Last Update'].length - 8, rtSystemConditions['Last Update'].length - 3));
               console.log(extremeEvents);
          }

          // check if demand is >= 90% total capacity 
          if(rtSystemConditions['Actual System Demand'] / rtSystemConditions['Total System Capacity'] >= .90){
               client.v2.tweet("Grid Status: Warning ⚠️\n-- Demand @ >= 90% Supply\n-- Reduce electricity consumption where possible" + "\n" + "Current Demand/Total Demand: " + rtSystemConditions['Actual System Demand'] + "/" + rtSystemConditions['Total System Capacity'] + "\n" + "Current Grid Frequency: " + rtSystemConditions['Current Frequency'] + " Hz")
               console.log('tweeted alert')
               extremeEvents.push(rtSystemConditions['Last Update'].slice(rtSystemConditions['Last Update'].length - 8, rtSystemConditions['Last Update'].length - 3));
               console.log(extremeEvents);
          }


     })
     .catch((err) => {
          res.send("error" + err);
     })
     
     
}

///////////////////////////////
///////// LOG DATA ////////////
///////////////////////////////

const logRTData = () => {
     // make 'logs' directory if it doesn't already exist
     fs.mkdir(path.join(__dirname, 'logs'), (err) => {
          if(err.errno !== -17 ){
               console.log(err)
          }
          
     })
     
     //create file name from today's date
     let date = new Date().toLocaleDateString('en-US').replace(/\//g, '-'); // replaces all '/' with '-'
     console.log(date + " " + new Date().toLocaleTimeString('en-US'));
     
     // append file with data stored in rtSystemConditions
     for (const key in rtSystemConditions){
          fs.appendFileSync(path.join(__dirname, `/logs/${date}.txt`), (`${key}: ${rtSystemConditions[key]}` + '\n'));
     }
     
}

///////////////////////////////
///////   PARSE DATA  /////////
///////////////////////////////

const parseRTData = (stat) => {
     let sum = 0;
     
     let date = new Date().toLocaleDateString('en-US').replace(/\//g, '-'); // replaces all '/' with '-';
     
     if (stat === 'avg-freq'){
          let file = fs.readFileSync(path.join(__dirname, `/logs/${date}.txt`), 'utf-8').split('\n');
          file.pop();
          for (let i = 0; i < file.length; i += 14){
               sum += parseFloat(file[i].slice(file[i].indexOf(':') + 2, file[i].length));
          }
          return (sum / file.length * 14).toFixed(3);
     }
     
}

const checkGridStatus = (checkType=0) => {
     // checkType 0 = auto
     // checkType 1 = manual
     
     //server time is one hour ahead
     
     let serverHours = new Date().getHours();
     let serverMinutes = new Date().getMinutes();
     
     if (checkType === 0){
          if ( (serverHours === 11 && serverMinutes === 59) || (serverHours === 23 && serverMinutes === 59) ) {
               /// this is where tweet will go
               console.log(parseRTData('avg-freq'));
               
               // reset tracking variables
               if(serverHours === 23 || serverHours === 0){
                    extremeEvents = 0;
               }
          }
     }
     
     if(checkType === 1){
          return parseRTData('avg-freq');
     }
     
     
}

// ROUTES

app.get("/ercot-api/", (req, res) => {
     res.send("ERCOT Realtime Grid Status API");
     
});

app.get("/ercot-api/realtime", (req, res) => {
     
     new Promise((resolve, reject) => {
          resolve(rtSystemConditions)
          reject('no data')
     }).then((data) => {
          res.json(data);
     }).catch((err) => {
          res.send(err)
     });
     
});

app.get("/ercot-api/gridstatus", (req, res) => {
     res.send('average grid frequency for today: ' + checkGridStatus(1));
})

server = app.listen(PORT, () => {
     console.log("Listening on port: " + PORT);  
     
     getRTData();
     
     checkGridStatus();
     
     setInterval(() => {
          logRTData();
          //    client.v2.tweet('Current System Frequency: ' + rtSystemConditions['Current Frequency']);
          console.log('logged');
          getRTData();
     }, 60000); // every 60 seconds data is logged
});