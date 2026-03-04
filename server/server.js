require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const app = express();
const path = require('path');
const PORT = 3335;
//const controller = require('./controllers');
//const { Token } = require('acorn');


app.use('/build', express.static(path.join(__dirname, '../build')));

//Listing paramaters for API call
const optionsP= {
  method: 'POST',
  headers: {Authorization: `Token ${process.env.TERMINAL49_API_KEY}`, 'Content-Type': 'application/json'},
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
.catch(err => console.error(err));

// GET terminal ETA by shipment ID
app.get('/api/shipments/:shipmentId/eta', async (req, res) => {
  const { shipmentId } = req.params;

  try {
    const response = await fetch(`https://api.terminal49.com/v2/shipments/${shipmentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${process.env.TERMINAL49_API_KEY}`,
        'Content-Type': 'application/vnd.api+json'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Terminal49 API error: ${response.statusText}` });
    }

    const json = await response.json();
    const attrs = json.data.attributes;

    res.json({
      shipment_id: shipmentId,
      pod_eta_at: attrs.pod_eta_at,
      pod_ata_at: attrs.pod_ata_at,
      pod_original_eta_at: attrs.pod_original_eta_at,
      destination_eta_at: attrs.destination_eta_at,
      destination_ata_at: attrs.destination_ata_at,
      pod_timezone: attrs.pod_timezone,
      destination_timezone: attrs.destination_timezone
    });
  } catch (err) {
    console.error('Error fetching shipment ETA:', err);
    res.status(500).json({ error: 'Failed to fetch shipment ETA' });
  }
});


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
