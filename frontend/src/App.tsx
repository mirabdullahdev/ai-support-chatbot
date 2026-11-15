import { Route, Routes } from "react-router-dom";

import { ChatWidget } from "@/components/chat/ChatWidget";
import { Storefront } from "@/components/storefront/Storefront";
import { AdminApp } from "@/pages/admin/AdminApp";

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <Storefront />
            <ChatWidget />
          </>
        }
      />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="*" element={<Storefront />} />
    </Routes>
  );
}
