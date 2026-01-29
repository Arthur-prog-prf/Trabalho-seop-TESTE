import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Carrega as variáveis de ambiente do arquivo .env ou do painel do Netlify
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Permite que o código acesse as chaves via process.env ou import.meta.env
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // Define o atalho '@' para a pasta raiz do projeto
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Garante que o build seja otimizado para produção
        outDir: 'dist',
        sourcemap: false
      }
    };
});
