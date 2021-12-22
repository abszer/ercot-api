const express = require('express');
const requests = require('simple-requests');
const JSSoup = require('jssoup').default;
const { TwitterAPI } = require('twitter-api-v2');
const dotenv = require('dotenv')
const app = express();

dotenv.config()
const PORT = process.env.PORT || 3000;

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

const getRTData = () => {
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
             })
             .catch((err) => {
                  res.send("error" + err);
             })
}

app.get("/ercot-api/", (req, res) => {
     res.send("This is a test.")
          .statusCode(200);

})

app.get("/ercot-api/realtime", (req, res) => {
     res.json(rtSystemConditions)
          .statusCode(200);
});

server = app.listen(PORT, () => {
   console.log("Listening on port: " + PORT);  
   
   getRTData();
   setInterval(() => {
        getRTData();
   }, 60000);
});