// Type declarations for the <wayfinder-map> custom element
import type React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wayfinder-map": React.HTMLAttributes<HTMLElement> & React.RefAttributes<HTMLElement> & {
        // Required
        "data-url"?: string;
        "map-url"?: string;
        // Floor & focus
        "default-floor"?: string;
        "focus-node-id"?: string;
        "you-are-here-node-id"?: string;
        "route-mode"?: "escalator" | "lift";
        // View / zoom / scale (also accept desktop- / mobile- prefix)
        "render-scale"?: string;
        "desktop-render-scale"?: string;
        "mobile-render-scale"?: string;
        "min-zoom"?: string;
        "desktop-min-zoom"?: string;
        "mobile-min-zoom"?: string;
        "max-zoom"?: string;
        "desktop-max-zoom"?: string;
        "mobile-max-zoom"?: string;
        // Labels
        "label-font-size"?: string;
        "desktop-label-font-size"?: string;
        "mobile-label-font-size"?: string;
        "label-min-font-size"?: string;
        "desktop-label-min-font-size"?: string;
        "mobile-label-min-font-size"?: string;
        "map-label-font-family"?: string;
        "map-label-font-color"?: string;
        "map-label-background-color"?: string;
        // Controls & flags
        "level-selector"?: string;
        "search-control"?: string;
        "enable-rotation"?: string;
        "disable-rotation"?: string;
        "show-fps"?: string;
        "locale"?: string;
        // Theming
        "control-fg-color"?: string;
        "control-bg-color"?: string;
        "control-active-fg-color"?: string;
        "control-active-bg-color"?: string;
        "map-marker-start-fg-color"?: string;
        "map-marker-start-bg-color"?: string;
        "map-marker-end-fg-color"?: string;
        "map-marker-end-bg-color"?: string;
        "map-marker-connector-fg-color"?: string;
        "map-marker-connector-bg-color"?: string;
        // Custom icons
        "icon-walk"?: string;
        "icon-stand"?: string;
        "icon-pin"?: string;
        "icon-qr"?: string;
        "icon-wheelchair"?: string;
        "icon-escalator"?: string;
      };
    }
  }
}
