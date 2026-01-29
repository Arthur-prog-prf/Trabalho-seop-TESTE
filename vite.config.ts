import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Configuração oficial do Vite para o Sistema de Convocação PRF/ES.
 * Este ficheiro gere a segurança das chaves de API e a compilação para o Netlify.
 */
export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente (como a VITE_GEMINI_API_KEY) 
  // do sistema ou de um ficheiro .env local.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // Ativa o suporte para React
    plugins: [react()],
    
    // Define variáveis globais que o código pode aceder
    define: {
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        // Permite usar '@' como atalho para a pasta 'src' nos imports
        '@': path.resolve(__dirname, './src'),
      },
    },

    build: {
      // Define 'dist' como a pasta de saída (exigência do Netlify)
      outDir: 'dist',
      // Gera mapas de código para facilitar a correção de erros
      sourcemap: true,
      // Garante que o bundle seja limpo antes de cada nova construção
      emptyOutDir: true,
    },

    server: {
      // Configurações para quando estiver a testar no seu computador
      port: 3000,
      host: true,
      strictPort: true,
    }
  };
});
