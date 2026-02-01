export function toast(message, type = "success") {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");

  el.className =
    "editorial-card px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl editorial-shadow border-l-8 " +
    (type === "error" ? "border-l-red-600" : "border-l-ink");

  el.innerText = message;
  root.appendChild(el);

  setTimeout(() => el.remove(), 3500);
}
