import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        proxy: {
            '/socket.io/': {
                target: "*",
                changeOrigin: true,
                secure: true,
                ws: true, // Enable WebSocket proxying
            },
            '/*': {
                target: 'http://localhost:3000', // Socket server running here
                changeOrigin: true,
                secure: true,
                ws: true, // Enable WebSocket proxying
            },
        },
    },
})
