import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
export const loader = async ({ request }) => {
    await authenticate.admin(request);
    return {ok: true};
};
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();

  const title = formData.get("title");
  const discountType = formData.get("discountType");
  const value = Number(formData.get("value"));
  const numberOfCodes = Number(formData.get("numberOfCodes"));
  const codeLength = Number(formData.get("codeLength"));
  const startDate = formData.get("startDate");

 const discountValue =
  discountType === "percentage"
    ? { percentage: value / 100 }   // ✅ FIX HERE
    : {
        discountAmount: {
          amount: value.toFixed(2),
          appliesOnEachItem: false,
        },
      };


  function generateCode(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  }

  const codes = new Set();
  while (codes.size < numberOfCodes) {
    codes.add(generateCode(codeLength));
  }

  const [firstCode, ...restCodes] = [...codes];

  // ✅ Create Discount
  const createRes = await admin.graphql(`
    mutation CreateDiscount($discount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $discount) {
        codeDiscountNode {
          id
        }
        userErrors {
          message
        }
      }
    }
  `, {
    variables: {
      discount: {
        title,
        startsAt: startDate,
        code: firstCode,
        customerSelection: { all: true },
        customerGets: {
          value: discountValue,
          items: { all: true },
        },
      },
    },
  });

  const createJson = await createRes.json();
  console.log("Shopify Response:", JSON.stringify(createJson, null, 2));

  const discountId =
    createJson.data?.discountCodeBasicCreate?.codeDiscountNode?.id;

  if (!discountId) {
  return {
    error:
      createJson.data?.discountCodeBasicCreate?.userErrors?.[0]?.message ||
      "Failed to create discount",
  };
}


  // ✅ Add Remaining Codes
  for (const code of restCodes) {
    await admin.graphql(`
      mutation AddCodes($id: ID!, $codes: [DiscountRedeemCodeInput!]!) {
        discountRedeemCodeBulkAdd(discountId: $id, codes: $codes) {
          userErrors {
            message
          }
        }
      }
    `, {
      variables: {
        id: discountId,
        codes: [{ code }],
      },
    });
  }

  return { success: true, codes: [...codes] };
  
};




export default function CreateDiscountUI() {

    useLoaderData();
    const father = useFetcher();
    const [title, setTitle] = useState("Bulk Discount Offer");
    const [discountType, setDiscountType] = useState("percentage");
    const [value, setValue] = useState(10);
    const [numberOfCodes, setNumberOfCodes] = useState(5);
    const  [codeLength, setCodeLength] = useState(8);
    const [startDate, setStartDate] = useState(
        new Date().toISOString().split("T")[0]

    );

const [code, setCode] = useState([]);

const [error, setError] = useState("");
const [toast, setToast] = useState("");

useEffect(() => {
    if (!father.data) return;
    if (father.data.error) {
        setError(father.data.error);
        setToast("");
        setCode([]);
    } else if (father.data.success) {
        setToast("Discount codes generated successfully!");
        setCode(father.data.codes);
        setError("");
    }
}, [father.data]);



function submit (){
    setError("");
    setToast("");
    setCode([]);    

    const formData = new FormData();
    formData.append("title", title);
    formData.append("discountType", discountType);
    formData.append("value", value.toString());
    formData.append("numberOfCodes", numberOfCodes.toString());
    formData.append("codeLength", codeLength.toString());
    formData.append("startDate", startDate);

    father.submit(formData, {
        method: "post",
        action: "/app/creatediscount",  
    });

}
return (
    <s-page heading="Bulk discount code generator" padding = "base ">
        <s-section  heading="Create Discount Codes" padding="base">
        <s-card  padding="base">
            <s-stack gap="base">
                <s-text-field
                    label="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    padding="base"
                />
                <s-select
                    label="Discount Type"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    padding="base"
                >
                    <s-option value="percentage">Percentage</s-option>
                    <s-option value="fixed">Fixed Amount</s-option>
                </s-select>
                <s-text-field
                    label="Discount Value"
                    type="number"
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    padding="base"
                />
                <s-text-field
                    label="Number of Codes"
                    type="number"
                    value={numberOfCodes}
                    onChange={(e) => setNumberOfCodes(Number(e.target.value))}
                    padding="base"
                />
                <s-text-field
                    label="Code Length"
                    type="number"
                    value={codeLength}
                    onChange={(e) => setCodeLength(Number(e.target.value))}
                    padding="base"
                />
                <s-text-field
                    label="Start Date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    padding="base"
                />
                <s-button
                variant="primary"
                 onClick={submit}
                 disabled = {father.state === "submitting"}
                 padding="base">
                    {father.state === "submitting" ? "Generating..." : "Generate Codes"}
                </s-button>
                {father.state === "submitting" && <s-spinner size="small" /> }
                {error && <s-banner tone="critical" padding="base">{error}</s-banner>}
                {toast && <s-banner tone="success" padding="base">{toast}</s-banner>}
            </s-stack>
        </s-card>
        </s-section>

        {code.length > 0 && (
            <s-section heading="Generated Codes" padding="base">
                <s-card padding="base"> 
                    <s-unorderd-list padding="base">
                        {code.map((code) => (
                            <s-list-item key={code} padding="base" >{code}</s-list-item>
                        ))}
                    </s-unorderd-list>
                </s-card>
            </s-section> 
        )}       
    </s-page>
);
}