const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const detectImage = async (imagePath) => {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath));

    const response = await axios.post(`${AI_SERVICE_URL}/detect-image`, form, {
      headers: { ...form.getHeaders() },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    console.warn('⚠️ AI service unavailable, returning mock detection:', error.message);
    // Graceful fallback: return a mock detection result
    return {
      detected: true,
      confidence: 0.75,
      label: 'garbage',
      detections: [{ label: 'garbage', confidence: 0.75, bbox: [0, 0, 100, 100] }],
      mock: true,
    };
  }
};

const detectFrame = async (base64Frame) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/detect-frame`, { frame: base64Frame }, {
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    console.warn('⚠️ AI service unavailable for frame detection:', error.message);
    return { detected: false, confidence: 0, detections: [], mock: true };
  }
};

module.exports = { detectImage, detectFrame };
