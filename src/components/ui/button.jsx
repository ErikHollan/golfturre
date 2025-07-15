import * as React from "react";

export function Button({ className = "", ...props }) {
  return (
    <button
      className={
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none " +
        "bg-green-600 text-white hover:bg-green-700 px-4 py-2 " +
        className
      }
      {...props}
    />
  );
}
