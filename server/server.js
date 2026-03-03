const express = require('express');
const app = express();
const path = require('path');
const PORT = 3333;
//const controller = require('./controllers');
//const { Token } = require('acorn');


app.use('/build', express.static(path.join(__dirname, '../build')));

//Listing paramaters for API call
const optionsP= {
  method: 'POST',
  headers: {Authorization: 'Token MJM2Ler3McaDUHcErMxCqMVo', 'Content-Type': 'application/json'},
  body: JSON.stringify({
    data: {
      attributes: {
        request_type: 'bill_of_lading',
        request_number: 'CMDULHV3925105',
        ref_numbers: ['8157US306035655', 'UA1710955', 'UA1710955'],
        // shipment_tags: ['camembert'],
        scac: 'CMDU'
      },
      // relationships: {customer: {data: {id: 'f7cb530a-9e60-412c-a5bc-205a2f34ba54', type: 'party'}}},
      type: 'tracking_request'
    }
  })
};

//API CALL
fetch('https://api.terminal49.com/v2/tracking_requests', optionsP)
.then(res => res.json())
.then(res => console.log(res))
.then(console.log(("POD ETA:", data.data.attributes.pod_eta_at)))
.catch(err => console.error(err));

//GET ETA
const optionsG =  {
  method: 'GET',
  headers: {Authorization: 'Token MJM2Ler3McaDUHcErMxCqMVo', 'Content-Type': 'application/vnd.api+json'},
  // body: JSON.stringify({
  //   data: {
  //     attributes: {
  //       pod_eta_at,
  //       pod_original_eta_at,
  //       destination_eta_at

  //     },
  //     // relationships: {customer: {data: {id: 'f7cb530a-9e60-412c-a5bc-205a2f34ba54', type: 'party'}}},
  //     type: 'tracking_request'
  //   }
  // })
}

fetch('https://api.terminal49.com/v2/shipments/3c6eea72-0897-4de2-8e98-ecbb63420172', optionsG)
.then(res => res.json())
.then(res => console.log(res))
.catch(err => console.error(err));







// global error handler

app.use((err, req, res, next) => {
  const defaultErr = {
    log: 'Express error handler caught unknown middleware error',
    status: 500,
    message: { err: 'An error occurred' },
  };
  const errorObj = Object.assign({}, defaultErr, err);
  console.log(errorObj.log);
  return res.status(errorObj.status).json(errorObj.message);
});


//local host running. 
app.listen(PORT, () => {
  console.log(`Server listening on port: ${PORT}...`);
});
  module.exports = app;