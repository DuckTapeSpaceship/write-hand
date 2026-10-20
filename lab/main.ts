import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/600.css'
import '../src/styles/base.css'
import { mount } from 'svelte'
import Lab from './Lab.svelte'

mount(Lab, { target: document.getElementById('lab')! })
