import {defineConfig} from 'vite';
export default defineConfig({server:{port:5174,proxy:{'/api':'http://127.0.0.1:8081'}},build:{target:'es2022'}});
