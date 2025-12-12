import React from "react";
import ReactDOM from "react-dom/client";
import Popup from "./pages/Popup";

const container = document.createElement('div');
document.body.appendChild(container);

ReactDOM.createRoot(container).render(
  <React.StrictMode>
	<Popup />
  </React.StrictMode>
);
