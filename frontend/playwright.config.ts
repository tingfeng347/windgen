import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./e2e',timeout:45000,workers:1,use:{baseURL:'http://127.0.0.1:5173',headless:true,channel:'chromium',launchOptions:{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},reporter:'list'})
