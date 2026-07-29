const WA = "917827110079";

window.menuToggle = function menuToggle() {
  document.querySelector(".links")?.classList.toggle("show");
};

window.sendWA = function sendWA(id) {
  const form = document.getElementById(id);
  if (!(form instanceof HTMLFormElement)) return false;

  const data = new FormData(form);
  const message = ["Hello VP Loan Connect, I want loan assistance."];

  for (const [key, value] of data.entries()) {
    if (value) message.push(`${key}: ${value}`);
  }

  message.push("I understand approval is subject to lender eligibility and policies.");
  window.open(`https://wa.me/${WA}?text=${encodeURIComponent(message.join("\n"))}`, "_blank");
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
