import { EventEmitter } from 'events';

const notificationEvents = new EventEmitter();

// Limit listeners to avoid warnings in high-traffic scenarios
notificationEvents.setMaxListeners(100);

export default notificationEvents;
