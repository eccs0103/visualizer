"use strict";

const body = document.body;

//#region Dialog alert
const dialogAlert = body.appendChild(document.createElement(`dialog`));
dialogAlert.classList.add(`pop-up`, `alert`, `layer`, `rounded`, `with-padding`, `with-gap`, `flex`, `column`);

const divAlertCoontainer = dialogAlert.appendChild(document.createElement(`div`));
divAlertCoontainer.classList.add(`container`);
divAlertCoontainer.innerText = `Something went wrong. This text wasn't supposed to appear before you. There might be an internal core error.`;
//#endregion
//#region Dialog confirm
const dialogConfirm = body.appendChild(document.createElement(`dialog`));
dialogConfirm.classList.add(`pop-up`, `confirm`, `layer`, `rounded`, `with-padding`, `with-gap`, `flex`, `column`);

const divConfirmContainer = dialogConfirm.appendChild(document.createElement(`div`));
divConfirmContainer.classList.add(`container`);
divConfirmContainer.innerText = `Something went wrong. This text wasn't supposed to appear before you. There might be an internal core error.`;

const divConfirmFooter = dialogConfirm.appendChild(document.createElement(`div`));
divConfirmFooter.classList.add(`footer`, `flex`, `centered`, `with-gap`);

const buttonConfirmAccept = divConfirmFooter.appendChild(document.createElement(`button`));
buttonConfirmAccept.classList.add(`layer`, `rounded`, `flex`, `with-padding`, `highlight`);
buttonConfirmAccept.innerText = `Accept`;

const buttonConfirmDecline = divConfirmFooter.appendChild(document.createElement(`button`));
buttonConfirmDecline.classList.add(`layer`, `rounded`, `flex`, `with-padding`, `invalid`);
buttonConfirmDecline.innerText = `Decline`;
//#endregion
//#region Dialog prompt
const dialogPrompt = body.appendChild(document.createElement(`dialog`));
dialogPrompt.classList.add(`pop-up`, `prompt`, `layer`, `rounded`, `with-padding`, `with-gap`, `flex`, `column`);

const divPromptContainer = dialogPrompt.appendChild(document.createElement(`div`));
divPromptContainer.classList.add(`container`);
divPromptContainer.innerText = `Something went wrong. This text wasn't supposed to appear before you. There might be an internal core error.`;

const divPromptFooter = dialogPrompt.appendChild(document.createElement(`div`));
divPromptFooter.classList.add(`footer`, `flex`, `centered`, `with-gap`);

const buttonPromptAccept = divPromptFooter.appendChild(document.createElement(`button`));
buttonPromptAccept.classList.add(`layer`, `rounded`, `flex`, `with-padding`, `highlight`);
buttonPromptAccept.innerText = `Accept`;

const inputPrompt = divPromptFooter.appendChild(document.createElement(`input`));
inputPrompt.classList.add(`depth`, `rounded`, `flex`, `with-padding`);
inputPrompt.type = `text`;
inputPrompt.placeholder = `Enter text...`;
//#endregion

export { dialogAlert, divAlertCoontainer, dialogConfirm, divConfirmContainer, buttonConfirmAccept, buttonConfirmDecline, dialogPrompt, divPromptContainer, buttonPromptAccept, inputPrompt };
