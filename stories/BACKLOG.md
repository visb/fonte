# Backlog

- o campo "estado civil" deve incluir "união estável"
- no app adm, no acolhimento, fazer salvamento automatico conforme o acolhimento progride, para proteger os dados ja preenchidos em caso de queda de energia
- nao to conseguindo gerar recibos da contribuição mensal dos filhos, esta dando 404 no servidor:
  ```
  {
      "message": "Nenhum template de recibo cadastrado para contribuição mensal do acolhido. Cadastre em Configurações → Templates.",
      "error": "Not Found",
      "statusCode": 404
  }
  ```
  mas eu tenho um recibo cadastrado:
  ```
  [
    {
        "id": "bc0c2f99-5c93-435c-af7f-eb13d436b25f",
        "name": "teste",
        "content": "<p>testexD</p>",
        "isRequired": false,
        "signAtAdmission": false,
        "availableFor": "ALL",
        "kind": "RECEIPT",
        "receiptType": "ASSOCIATE_CONTRIBUTION",
        "updatedAt": "2026-10-15T20:44:35.984Z"
    }
  ]
  ```
