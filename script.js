window.menuToggle = function menuToggle() {
  document.querySelector(".links")?.classList.toggle("show");
};

/** Legacy contact helper — public WhatsApp CTAs removed. Route users to Quick Apply. */
window.sendWA = function sendWA() {
  window.location.href = "/apply/quick";
  return false;
};

function calc() {
  const principal = Number(amount.value) || 0;
  const monthlyRate = (Number(rate.value) || 0) / 1200;
  const tenureMonths = Number(months.value) || 0;
  if (!principal || !tenureMonths) return;

  const emiValue = monthlyRate
    ? (principal * monthlyRate * (1 + monthlyRate) ** tenureMonths) / ((1 + monthlyRate) ** tenureMonths - 1)
    : principal / tenureMonths;
  const totalValue = emiValue * tenureMonths;

  emi.textContent = `₹${Math.round(emiValue).toLocaleString("en-IN")}`;
  interest.textContent = `₹${Math.round(totalValue - principal).toLocaleString("en-IN")}`;
  total.textContent = `₹${Math.round(totalValue).toLocaleString("en-IN")}`;
}

document.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.classList.contains("fq")) {
    event.target.parentElement?.classList.toggle("open");
  }
});

document.addEventListener("DOMContentLoaded", calc);
