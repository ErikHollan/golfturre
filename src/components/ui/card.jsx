import * as React from "react";

export function Card({ className = "", ...props }) {
  return (
    <div
      className={
        "rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm " + className
      }
      {...props}
    />
  );
}

export function CardContent({ className = "", ...props }) {
  return <div className={"p-6 pt-0 " + className} {...props} />;
}
