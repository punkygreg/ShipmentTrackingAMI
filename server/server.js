require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const app = express();
const path = require('path');
const PORT = 3335;
const controller = require('./controllers');
const powerbiController = require('./powerbiController');


app.use('/build', express.static(path.join(__dirname, '../build')));
app.use(express.json());

// Terminal49 Routes
app.post('/api/tracking_requests', controller.createTrackingRequest);
app.get('/api/shipments/:shipmentId/eta', controller.getShipmentEta);

// Power BI Routes
// app.put('/api/powerbi/rows', powerbiController.putRows);
app.patch('/api/powerbi/rows', powerbiController.patchRows);
app.patch('/api/powerbi/pod-eta', powerbiController.updatePodEta);
app.post('/api/powerbi/query', powerbiController.executeQuery);
app.get('/api/powerbi/tables', powerbiController.getTables);


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
