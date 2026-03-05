module.exports = {
  apps: [
    {
      name: 'user-sms',
      script: 'src/server.js',
      // 'max' = по числу CPU ядер сервера
      // Для одного сервера с Socket.IO используй 'max'
      // ВАЖНО: при cluster mode Socket.IO нужен Redis adapter (socket.io-redis)
      // Пока сервис на одном сервере — используй instances: 1
      // Когда будешь масштабировать на несколько серверов — переключи на 'max' + Redis adapter
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 6000,
      },
      // Автоматический перезапуск при падении
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 10,
    },
  ],
};
