import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/600.css'
import './styles/base.css'
import { mount } from 'svelte'
import App from './App.svelte'

mount(App, { target: document.getElementById('app')! })
