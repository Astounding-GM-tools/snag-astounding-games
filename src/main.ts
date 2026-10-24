import { mount } from 'svelte';
import App from './ui/App.svelte';
import './ui/app.css';
import './ui/table.css';

// Short screens get a compact table. Decided once, at load (when a phone's
// browser bars are showing), so the layout never shifts if they hide later.
document.documentElement.classList.toggle('short', window.innerHeight <= 740);

mount(App, { target: document.getElementById('app')! });
