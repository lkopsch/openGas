import React from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter} from 'react-router-dom';
import App from './App';
import './index.css';
history.scrollRestoration='manual';
if(import.meta.env.VITE_MOBILE==='1'){
 import('@capacitor/app').then(({App})=>App.addListener('backButton',()=>{if(history.state?.sheet||(location.hash&&location.hash!=='#/'&&location.hash!=='#'))history.back();else App.exitApp();}));
 import('@capacitor/status-bar').then(({StatusBar})=>StatusBar.setOverlaysWebView({overlay:false})).catch(()=>{});
 const theme=()=>import('@capacitor/status-bar').then(({StatusBar,Style})=>StatusBar.setStyle({style:document.documentElement.dataset.theme==='dark'?Style.Dark:Style.Light})).catch(()=>{});
 new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});theme();
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><HashRouter><App/></HashRouter></React.StrictMode>);
