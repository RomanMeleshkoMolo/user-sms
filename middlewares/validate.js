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
  // text обязателен только для обычных текстовых/системных сообщений —
  // voice и photo сообщения содержимое несут в своих полях (voiceUrl/photoUrl)
  sendMessage: Joi.object({
    text: Joi.string().max(5000).allow('').when('messageType', {
      is: Joi.string().valid('voice', 'photo'),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
    nonce: Joi.string().max(500).allow(null),
    messageType: Joi.string().valid('text', 'voice', 'photo', 'system').default('text'),
    replyTo: Joi.object({
      _id: Joi.string(),
      text: Joi.string().allow(''),
      senderId: Joi.string().allow(null),
    }).unknown(true),
    isPrivate: Joi.boolean(),
    // Поля голосового сообщения
    voiceUrl: Joi.string().max(2000).when('messageType', {
      is: 'voice',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    voiceKey: Joi.string().max(500).allow(null),
    voiceDuration: Joi.number().min(0),
    voiceNonce: Joi.string().max(500).allow(null),
    voiceWaveform: Joi.array().items(Joi.number()).allow(null),
    // Поля фото-сообщения
    photoUrl: Joi.string().max(2000).when('messageType', {
      is: 'photo',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    photoKey: Joi.string().max(500).allow(null),
    photoNonce: Joi.string().max(500).allow(null),
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