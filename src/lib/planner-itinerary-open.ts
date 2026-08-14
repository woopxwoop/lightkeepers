import { writable } from "svelte/store";

/** Layout sheet for the farming itinerary (closed on the planner page). */
export const plannerItineraryOpen = writable(false);
