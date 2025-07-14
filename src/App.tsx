import { useState, useRef, useEffect } from 'react'
import { Button } from './components/ui/button'
import { Textarea } from './components/ui/textarea'
import { ScrollArea } from './components/ui/scroll-area'
import { Separator } from './components/ui/separator'
import { 
  MessageSquare, 
  Plus, 
  Send, 
  Menu, 
  X, 
  Copy, 
  RotateCcw,
  Sun,
  Moon,
  Settings,
  HelpCircle,
  User
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  updatedAt: Date
}

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentConversation = conversations.find(c => c.id === currentConversationId)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentConversation?.messages])

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      updatedAt: new Date()
    }
    setConversations(prev => [newConversation, ...prev])
    setCurrentConversationId(newConversation.id)
  }

  const generateTitle = (firstMessage: string) => {
    return firstMessage.length > 30 
      ? firstMessage.substring(0, 30) + '...'
      : firstMessage
  }

  const sendMessage = async () => {
    if (!input.trim()) return

    let conversationId = currentConversationId
    
    // Create new conversation if none exists
    if (!conversationId) {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: generateTitle(input),
        messages: [],
        updatedAt: new Date()
      }
      setConversations(prev => [newConversation, ...prev])
      conversationId = newConversation.id
      setCurrentConversationId(conversationId)
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    // Add user message
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { 
            ...conv, 
            messages: [...conv.messages, userMessage],
            title: conv.messages.length === 0 ? generateTitle(input) : conv.title,
            updatedAt: new Date()
          }
        : conv
    ))

    setInput('')
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I'm a ChatGPT clone interface. You said: "${userMessage.content}"\n\nThis is a demo response. In a real implementation, this would connect to an AI service like OpenAI's API to generate intelligent responses.`,
        timestamp: new Date()
      }

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { 
              ...conv, 
              messages: [...conv.messages, assistantMessage],
              updatedAt: new Date()
            }
          : conv
      ))
      setIsLoading(false)
    }, 1000)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const regenerateResponse = () => {
    // In a real app, this would regenerate the last assistant message
    console.log('Regenerate response')
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden chatgpt-sidebar flex flex-col`}>
        <div className="p-3">
          <Button 
            onClick={createNewConversation}
            className="w-full justify-start gap-2 bg-transparent border border-[hsl(var(--chatgpt-border))] text-foreground hover:bg-[hsl(var(--chatgpt-sidebar-hover))]"
            variant="outline"
          >
            <Plus className="w-4 h-4" />
            New chat
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <Button
                key={conversation.id}
                onClick={() => setCurrentConversationId(conversation.id)}
                variant="ghost"
                className={`w-full justify-start text-left h-auto p-3 chatgpt-sidebar-item ${
                  currentConversationId === conversation.id ? 'bg-[hsl(var(--chatgpt-sidebar-hover))]' : ''
                }`}
              >
                <MessageSquare className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate text-sm">{conversation.title}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>

        <Separator />
        
        <div className="p-3 space-y-1">
          <Button variant="ghost" className="w-full justify-start chatgpt-sidebar-item">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button variant="ghost" className="w-full justify-start chatgpt-sidebar-item">
            <HelpCircle className="w-4 h-4 mr-2" />
            Help & FAQ
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start chatgpt-sidebar-item"
            onClick={() => setIsDark(!isDark)}
          >
            {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
            {isDark ? 'Light mode' : 'Dark mode'}
          </Button>
          <Button variant="ghost" className="w-full justify-start chatgpt-sidebar-item">
            <User className="w-4 h-4 mr-2" />
            My account
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--chatgpt-border))]">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2"
            >
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
            <h1 className="text-lg font-semibold">
              {currentConversation?.title || 'ChatGPT'}
            </h1>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-6">
            {!currentConversation || currentConversation.messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-4 bg-[hsl(var(--chatgpt-primary))] rounded-full flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">How can I help you today?</h2>
                <p className="text-[hsl(var(--chatgpt-text-secondary))]">
                  Start a conversation by typing a message below
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {currentConversation.messages.map((message) => (
                  <div key={message.id} className="group">
                    <div className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 bg-[hsl(var(--chatgpt-primary))] rounded-full flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-4 h-4 text-white" />
                        </div>
                      )}
                      
                      <div className={`max-w-[70%] ${message.role === 'user' ? 'order-first' : ''}`}>
                        <div className={`p-4 rounded-2xl ${
                          message.role === 'user' 
                            ? 'chatgpt-message-user ml-auto' 
                            : 'chatgpt-message-assistant bg-muted'
                        }`}>
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                        
                        {message.role === 'assistant' && (
                          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyMessage(message.content)}
                              className="h-8 px-2"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={regenerateResponse}
                              className="h-8 px-2"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      {message.role === 'user' && (
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-[hsl(var(--chatgpt-primary))] rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-muted p-4 rounded-2xl">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-[hsl(var(--chatgpt-text-secondary))] rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-[hsl(var(--chatgpt-text-secondary))] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-[hsl(var(--chatgpt-text-secondary))] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-[hsl(var(--chatgpt-border))] p-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Message ChatGPT..."
                className="min-h-[52px] max-h-32 pr-12 resize-none border-[hsl(var(--chatgpt-border))] focus:border-[hsl(var(--chatgpt-primary))] focus:ring-[hsl(var(--chatgpt-primary))]"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                size="sm"
                className="absolute right-2 bottom-2 w-8 h-8 p-0 bg-[hsl(var(--chatgpt-primary))] hover:bg-[hsl(var(--chatgpt-primary-hover))] disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-[hsl(var(--chatgpt-text-secondary))] text-center mt-2">
              ChatGPT can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App