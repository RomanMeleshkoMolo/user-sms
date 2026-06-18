const Joi = require('joi');

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map(d => d.message).join('; ');
      return res.status(400).json({ message: messages });
    }
    next();
  };
}

const schemas = {
  sendMessage: Joi.object({
    text: Joi.string().max(5000).required(),
    nonce: Joi.string().max(500).allow(null),
    messageType: Joi.string().valid('text', 'voice', 'photo', 'system').default('text'),
  }),

  registerPublicKey: Joi.object({
    publicKey: Joi.string().max(500).required(),
  }),

  pushToken: Joi.object({
    token: Joi.string().max(500).required(),
    platform: Joi.string().valid('android', 'ios').max(10),
    deviceId: Joi.string().max(255),
  }),
};

module.exports = { validate, schemas };