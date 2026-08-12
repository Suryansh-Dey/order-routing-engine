const Groq = require('groq-sdk');

console.log('Groq key loaded:', process.env.GROQ_API_KEY?.slice(0, 10));

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

exports.generateExplanation = async ({ productName, selectedWarehouse, distance, inventory, deliveryDays, cost, finalScore, distScore, invScore, delScore, costScore, weights, rejectedWarehouses }) => {
  try {
    if (!groq) {
      return "AI explanation skipped because GROQ_API_KEY is not set.";
    }


    const promptText = `
You are an expert logistics AI for an Order Routing Engine. We just routed an order for "${productName}".
The selected warehouse is ${selectedWarehouse}.

Current Routing Configuration (Weights):
- Distance: ${weights.distanceWeight}%
- Inventory Health: ${weights.inventoryWeight}%
- Delivery Speed: ${weights.deliveryWeight}%
- Cost Efficiency: ${weights.costWeight}%

Normalized Scores for the winning warehouse (0.0 = Worst, 1.0 = Best):
- Distance Score: ${distScore.toFixed(4)}
- Inventory Score: ${invScore.toFixed(4)}
- Delivery Score: ${delScore.toFixed(4)}
- Cost Score: ${costScore.toFixed(4)}
- Final Routing Score: ${finalScore.toFixed(4)}

Raw Metrics for the winning warehouse:
- Distance: ${distance.toFixed(2)} km
- Inventory Available: ${inventory}
- Delivery Estimate: ${deliveryDays} days
- Cost Estimate: ₹${cost.toFixed(2)}

Other candidate warehouses that were considered and rejected:
${rejectedWarehouses.map(s => `- ${s.warehouseName}: Final Score ${s.finalScore.toFixed(4)} (Dist: ${s.distScore.toFixed(4)}, Inv: ${s.invScore.toFixed(4)}, Del: ${s.delScore.toFixed(4)}, Cost: ${s.costScore.toFixed(4)})`).join('\n')}

Please provide a concise, business-friendly explanation (max 3 sentences) in plain English of why ${selectedWarehouse} was chosen over the others based on the configured weights and their respective scores. Be professional and clear.
NEVER mentions scores to user. They are for your understanding.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: promptText }],
      model: "llama-3.1-8b-instant",
      max_tokens: 150,
    });

    return chatCompletion.choices[0]?.message?.content || "";
  } catch (error) {
    console.error('Groq API Error:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
    return 'Failed to generate AI explanation.';
  }
};
