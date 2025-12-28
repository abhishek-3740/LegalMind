"""
LegalMind AI Assistant - Chatbot Service
Powered by LangChain and OpenRouter
"""

import os
from typing import Optional, List, Dict
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import (
    HumanMessage,
    SystemMessage,
    AIMessage,
    BaseMessage,
)
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

load_dotenv()


class LegalMindChatbot:
    """AI Assistant for LegalMind - helps users explore the app and analyze contracts"""
    
    SYSTEM_PROMPT = """You are LegalMind's AI Assistant, an expert legal advisor specialized in contract analysis.

Your key capabilities:
1. **Contract Analysis**: Help users understand contract clauses, identify risks, and suggest negotiations
2. **App Guidance**: Guide users through LegalMind features (document upload, risk analysis, chat)
3. **Legal Advice**: Provide general legal insights (not replacing professional lawyers)
4. **Risk Assessment**: Explain detected risks and their implications

Important Guidelines:
- Be concise but thorough in explanations
- Use simple language to explain legal concepts
- Always remind users that AI analysis complements human review
- Guide users to professional lawyers for critical decisions
- Focus on the document context when available
- Help users navigate LegalMind features

Current LegalMind Features Available:
- Upload & analyze PDF contracts
- Get AI-powered risk scores and risk detection
- Chat about specific clauses and negotiate terms
- Download detailed analysis reports
- Access dashboard with document history

When discussing risks:
- Explain severity levels (low, medium, high)
- Suggest negotiation points
- Recommend professional review for high-risk items
- Provide context on why something is flagged

Remember: You're here to empower users with information, not to replace legal professionals."""

    def __init__(self):
        """Initialize the LegalMind Chatbot with OpenRouter API"""
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.api_base = os.getenv("OPENAI_API_BASE")
        self.model = os.getenv("LLM_MODEL", "kwaipilot/kat-coder-pro:free")
        
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY not set in environment variables")
        if not self.api_base:
            raise ValueError("OPENAI_API_BASE not set in environment variables")
        
        # Initialize ChatOpenAI with OpenRouter
        self.chat_model = ChatOpenAI(
            model=self.model,
            openai_api_key=self.api_key,
            openai_api_base=self.api_base,
            temperature=0.7,
            max_tokens=500,
        )
        
        print(f"✅ LegalMind Chatbot initialized with model: {self.model}")

    def get_system_message(self, document_context: Optional[str] = None) -> SystemMessage:
        """Get system message with optional document context"""
        prompt = self.SYSTEM_PROMPT
        
        if document_context:
            prompt += f"\n\nCURRENT DOCUMENT CONTEXT:\n{document_context}"
        
        return SystemMessage(content=prompt)

    def chat(
        self,
        user_message: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        document_context: Optional[str] = None,
        document_name: Optional[str] = None,
    ) -> str:
        """
        Send a message to the chatbot and get a response
        
        Args:
            user_message: The user's message
            chat_history: Previous chat messages (list of {"role": "user"/"assistant", "content": "..."})
            document_context: Optional context about the current document
            document_name: Optional name of the current document
            
        Returns:
            The assistant's response
        """
        try:
            # Build message history
            messages: List[BaseMessage] = []
            
            # Add system message
            messages.append(self.get_system_message(document_context))
            
            # Add previous chat history
            if chat_history:
                for msg in chat_history:
                    if msg["role"] == "user":
                        messages.append(HumanMessage(content=msg["content"]))
                    elif msg["role"] == "assistant":
                        messages.append(AIMessage(content=msg["content"]))
            
            # Add current user message
            messages.append(HumanMessage(content=user_message))
            
            # Get response from model
            response = self.chat_model.invoke(messages)
            
            return response.content
            
        except Exception as e:
            print(f"Error in chatbot: {e}")
            return "I apologize, but I encountered an error. Please try again."

    def get_app_guidance(self, topic: str) -> str:
        """Get guidance on using specific LegalMind features"""
        guidance_prompts = {
            "upload": "How do I upload a document to LegalMind?",
            "analysis": "What information does the risk analysis provide?",
            "risk": "How are risk scores calculated?",
            "chat": "How can I use the chat feature?",
            "export": "How do I export my analysis?",
        }
        
        prompt = guidance_prompts.get(topic, f"Tell me about the {topic} feature in LegalMind")
        return self.chat(prompt)

    def analyze_clause(self, clause_text: str, clause_type: Optional[str] = None) -> str:
        """Get analysis of a specific clause"""
        context = f"Analyzing clause of type: {clause_type}" if clause_type else "Analyzing clause"
        prompt = f"{context}:\n\n{clause_text}\n\nPlease explain this clause, identify potential risks, and suggest negotiation points."
        return self.chat(prompt)

    def suggest_questions(self, document_name: str) -> List[str]:
        """Suggest questions the user might ask about a document"""
        suggestions = [
            "What are the key risks in this contract?",
            "Explain the liability clause",
            "Is the termination clause fair?",
            "What should I negotiate?",
            "What are my obligations under this contract?",
            "Are there any hidden fees or charges?",
            "What happens if I want to cancel?",
            "Is this contract favorable to both parties?",
        ]
        return suggestions


# Initialize global chatbot instance
_chatbot_instance: Optional[LegalMindChatbot] = None


def get_chatbot() -> LegalMindChatbot:
    """Get or create the chatbot instance (singleton)"""
    global _chatbot_instance
    if _chatbot_instance is None:
        _chatbot_instance = LegalMindChatbot()
    return _chatbot_instance


# Demo function
if __name__ == "__main__":
    chatbot = get_chatbot()
    
    # Test basic chat
    response = chatbot.chat("Hello! I'm new to LegalMind. Can you help me get started?")
    print("Bot:", response)
    
    # Test clause analysis
    clause = "The parties agree that the service shall be provided on an 'as-is' basis without any warranties."
    response = chatbot.analyze_clause(clause, "Warranty Clause")
    print("\nClause Analysis:", response)