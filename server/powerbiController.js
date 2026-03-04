const msal = require('@azure/msal-node');

const powerbiController = {};

// ── MSAL config for client credentials flow ──
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET
  }
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

// Helper: get an access token for the Power BI API
async function getAccessToken() {
  const result = await cca.acquireTokenByClientCredential({
    scopes: ['https://analysis.windows.net/powerbi/api/.default']
  });
  return result.accessToken;
}

const PBI_BASE = 'https://api.powerbi.com/v1.0/myorg';

// ────────────────────────────────────────────
//  PUT — update rows in a Power BI dataset table
// ────────────────────────────────────────────
// PUT /api/powerbi/rows
// Body: { "tableName": "Shipments", "rows": [ { ... }, { ... } ] }
// powerbiController.putRows = async (req, res, next) => {
//   const { tableName, rows } = req.body;
//   const workspaceId = process.env.PBI_WORKSPACE_ID;
//   const datasetId = process.env.PBI_DATASET_ID;

//   if (!tableName || !rows || !Array.isArray(rows)) {
//     return res.status(400).json({ error: 'tableName and rows (array) are required' });
//   }

//   try {
//     const token = await getAccessToken();

//     const response = await fetch(
//       `${PBI_BASE}/groups/${workspaceId}/datasets/${datasetId}/tables/${tableName}/rows`,
//       {
//         method: 'PUT',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({ rows })
//       }
//     );

//     if (!response.ok) {
//       const error = await response.json();
//       return res.status(response.status).json(error);
//     }

//     res.json({ success: true, rowCount: rows.length });
//   } catch (err) {
//     return next({
//       log: `Error in powerbiController.putRows: ${err}`,
//       status: 500,
//       message: { err: 'Failed to update rows in Power BI' }
//     });
//   }
// };

// ────────────────────────────────────────────
//  PATCH — partially update rows by key column
// ────────────────────────────────────────────
// PATCH /api/powerbi/rows
// Body: {
//   "tableName": "Shipments",
//   "keyColumn": "shipment_id",
//   "updates": [
//     { "shipment_id": "abc-123", "pod_eta_at": "2026-03-20T10:00:00Z" }
//   ]
// }
// Only the columns included in each update object will be changed;
// all other columns keep their existing values.
powerbiController.patchRows = async (req, res, next) => {
  const { tableName, keyColumn, updates } = req.body;
  const datasetId = process.env.PBI_DATASET_ID;
  const workspaceId = process.env.PBI_WORKSPACE_ID;

  if (!tableName || !keyColumn || !updates || !Array.isArray(updates)) {
    return res.status(400).json({ error: 'tableName, keyColumn, and updates (array) are required' });
  }

  try {
    const token = await getAccessToken();

    // Step 1: Read existing rows via DAX query
    const queryResponse = await fetch(
      `${PBI_BASE}/datasets/${datasetId}/executeQueries`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          queries: [{ query: `EVALUATE ${tableName}` }],
          serializerSettings: { includeNulls: true }
        })
      }
    );

    if (!queryResponse.ok) {
      const error = await queryResponse.json();
      return res.status(queryResponse.status).json(error);
    }

    const queryJson = await queryResponse.json();
    const existingRows = queryJson.results[0].tables[0].rows;

    // Step 2: Strip the "TableName[column]" prefix from DAX column names
    // DAX returns keys like "Shipments[shipment_id]" — we need just "shipment_id"
    const cleanedRows = existingRows.map(row => {
      const cleaned = {};
      for (const key in row) {
        const cleanKey = key.replace(/^.*\[(.+)\]$/, '$1');
        cleaned[cleanKey] = row[key];
      }
      return cleaned;
    });

    // Step 3: Build an update lookup from the keyColumn
    const updateMap = {};
    for (const update of updates) {
      updateMap[update[keyColumn]] = update;
    }

    // Step 4: Merge — only overwrite columns present in the update
    const mergedRows = cleanedRows.map(row => {
      const match = updateMap[row[keyColumn]];
      if (match) {
        return { ...row, ...match };
      }
      return row;
    });

    // Step 5: PUT the full merged table back
    const putResponse = await fetch(
      `${PBI_BASE}/groups/${workspaceId}/datasets/${datasetId}/tables/${tableName}/rows`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rows: mergedRows })
      }
    );

    if (!putResponse.ok) {
      const error = await putResponse.json();
      return res.status(putResponse.status).json(error);
    }

    const updatedCount = Object.keys(updateMap).length;
    res.json({ success: true, totalRows: mergedRows.length, updatedRows: updatedCount });
  } catch (err) {
    return next({
      log: `Error in powerbiController.patchRows: ${err}`,
      status: 500,
      message: { err: 'Failed to partially update rows in Power BI' }
    });
  }
};

// ────────────────────────────────────────────
//  UPDATE POD ETA — fetch from Terminal49, update in Power BI
// ────────────────────────────────────────────
// PATCH /api/powerbi/pod-eta
// Body: { "shipmentId": "abc-123", "bill_of_lading": "CMDULHV3925105" }
powerbiController.updatePodEta = async (req, res, next) => {
  const { shipmentId, bill_of_lading } = req.body;
  const datasetId = process.env.PBI_DATASET_ID;
  const workspaceId = process.env.PBI_WORKSPACE_ID;
  const tableName = 'Merge1';

  if (!shipmentId || !bill_of_lading) {
    return res.status(400).json({ error: 'shipmentId and bill_of_lading are required' });
  }

  try {
    const token = await getAccessToken();

    // Step 1: Get pod_eta_at from Terminal49
    const t49Response = await fetch(`https://api.terminal49.com/v2/shipments/${shipmentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${process.env.TERMINAL49_API_KEY}`,
        'Content-Type': 'application/vnd.api+json'
      }
    });

    if (!t49Response.ok) {
      return res.status(t49Response.status).json({ error: `Terminal49 API error: ${t49Response.statusText}` });
    }

    const t49Json = await t49Response.json();
    const podEta = t49Json.data.attributes.pod_eta_at;

    // Step 2: Read existing rows from Merge1
    const queryResponse = await fetch(
      `${PBI_BASE}/datasets/${datasetId}/executeQueries`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          queries: [{ query: `EVALUATE ${tableName}` }],
          serializerSettings: { includeNulls: true }
        })
      }
    );

    if (!queryResponse.ok) {
      const error = await queryResponse.json();
      return res.status(queryResponse.status).json(error);
    }

    const queryJson = await queryResponse.json();
    const existingRows = queryJson.results[0].tables[0].rows;

    // Step 3: Clean DAX column names and update pod_eta_at on the matching row
    const mergedRows = existingRows.map(row => {
      const cleaned = {};
      for (const key in row) {
        const cleanKey = key.replace(/^.*\[(.+)\]$/, '$1');
        cleaned[cleanKey] = row[key];
      }
      if (cleaned.bill_of_lading === bill_of_lading) {
        cleaned.pod_eta_at = podEta;
      }
      return cleaned;
    });

    // Step 4: PUT the full table back with updated pod_eta_at
    const putResponse = await fetch(
      `${PBI_BASE}/groups/${workspaceId}/datasets/${datasetId}/tables/${tableName}/rows`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rows: mergedRows })
      }
    );

    if (!putResponse.ok) {
      const error = await putResponse.json();
      return res.status(putResponse.status).json(error);
    }

    res.json({
      success: true,
      bill_of_lading,
      pod_eta_at: podEta
    });
  } catch (err) {
    return next({
      log: `Error in powerbiController.updatePodEta: ${err}`,
      status: 500,
      message: { err: 'Failed to update pod_eta in Power BI' }
    });
  }
};

// ────────────────────────────────────────────
//  PULL — execute a DAX query against the semantic model
// ────────────────────────────────────────────
// POST /api/powerbi/query
// Body: { "daxQuery": "EVALUATE TOPN(10, Shipments)" }
powerbiController.executeQuery = async (req, res, next) => {
  const { daxQuery } = req.body;
  const datasetId = process.env.PBI_DATASET_ID;

  if (!daxQuery) {
    return res.status(400).json({ error: 'daxQuery is required' });
  }

  try {
    const token = await getAccessToken();

    const response = await fetch(
      `${PBI_BASE}/datasets/${datasetId}/executeQueries`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          queries: [{ query: daxQuery }],
          serializerSettings: { includeNulls: true }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json(error);
    }

    const json = await response.json();
    res.json(json);
  } catch (err) {
    return next({
      log: `Error in powerbiController.executeQuery: ${err}`,
      status: 500,
      message: { err: 'Failed to execute DAX query' }
    });
  }
};

// ────────────────────────────────────────────
//  LIST — get tables in the dataset
// ────────────────────────────────────────────
// GET /api/powerbi/tables
powerbiController.getTables = async (req, res, next) => {
  const workspaceId = process.env.PBI_WORKSPACE_ID;
  const datasetId = process.env.PBI_DATASET_ID;

  try {
    const token = await getAccessToken();

    const response = await fetch(
      `${PBI_BASE}/groups/${workspaceId}/datasets/${datasetId}/tables`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json(error);
    }

    const json = await response.json();
    res.json(json);
  } catch (err) {
    return next({
      log: `Error in powerbiController.getTables: ${err}`,
      status: 500,
      message: { err: 'Failed to get Power BI tables' }
    });
  }
};

module.exports = powerbiController;
