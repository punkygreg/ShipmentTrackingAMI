const controller = {};



// POST tracking request with variable attributes
controller.createTrackingRequest = async (req, res, next) => {
  const { request_number, ref_numbers, scac } = req.body;

  if (!request_number || !scac) {
    return res.status(400).json({ error: 'request_number and scac are required' });
  }

  try {
    const response = await fetch('https://api.terminal49.com/v2/tracking_requests', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.TERMINAL49_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          attributes: {
            request_type: 'bill_of_lading',
            request_number,
            ref_numbers: ref_numbers || [],
            scac
          },
          type: 'tracking_request'
        }
      })
    });

    const json = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(json);
    }

    res.json(json);
  } catch (err) {
    return next({
      log: 'Error in controller.createTrackingRequest',
      status: 500,
      message: { err: 'Failed to create tracking request' }
    });
  }
};










// GET terminal ETA by shipment ID
controller.getShipmentEta = async (req, res, next) => {
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
    return next({
      log: 'Error in controller.getShipmentEta',
      status: 500,
      message: { err: 'Failed to fetch shipment ETA' }
    });
  }
};

module.exports = controller;
