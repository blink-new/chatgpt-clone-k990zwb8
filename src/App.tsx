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
  User,
  Loader2
} from 'lucide-react'
import { blink } from './blink/client'
import toast from 'react-hot-toast'

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
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentConversation = conversations.find(c => c.id === currentConversationId)

  // Auth state management
  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  // Load conversations when user is authenticated
  useEffect(() => {
    if (user?.id) {
      loadConversations()
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentConversation?.messages, streamingContent])

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  const loadConversations = async () => {
    try {
      const convs = await blink.db.conversations.list({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        limit: 50
      })

      const conversationsWithMessages = await Promise.all(
        convs.map(async (conv) => {
          const messages = await blink.db.messages.list({
            where: { conversationId: conv.id },
            orderBy: { createdAt: 'asc' }
          })

          return {
            id: conv.id,
            title: conv.title,
            updatedAt: new Date(conv.updatedAt),
            messages: messages.map(msg => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              timestamp: new Date(msg.createdAt)
            }))
          }
        })
      )

      setConversations(conversationsWithMessages)
    } catch (error) {
      console.error('Failed to load conversations:', error)
      toast.error('Failed to load conversations')
    }
  }

  const createNewConversation = async () => {
    if (!user?.id) return

    const newConversation: Conversation = {
      id: `conv_${Date.now()}`,
      title: 'New Chat',
      messages: [],
      updatedAt: new Date()
    }

    try {
      await blink.db.conversations.create({
        id: newConversation.id,
        userId: user.id,
        title: newConversation.title,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      setConversations(prev => [newConversation, ...prev])
      setCurrentConversationId(newConversation.id)
    } catch (error) {
      console.error('Failed to create conversation:', error)
      toast.error('Failed to create new conversation')
    }
  }

  const generateTitle = (firstMessage: string) => {
    return firstMessage.length > 30 
      ? firstMessage.substring(0, 30) + '...'
      : firstMessage
  }

  const updateConversationTitle = async (conversationId: string, title: string) => {
    try {
      await blink.db.conversations.update(conversationId, {
        title,
        updatedAt: new Date()
      })
    } catch (error) {
      console.error('Failed to update conversation title:', error)
    }
  }

  const saveMessage = async (conversationId: string, role: 'user' | 'assistant', content: string) => {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      await blink.db.messages.create({
        id: messageId,
        conversationId,
        userId: user.id,
        role,
        content,
        createdAt: new Date()
      })

      // Update conversation timestamp
      await blink.db.conversations.update(conversationId, {
        updatedAt: new Date()
      })

      return messageId
    } catch (error) {
      console.error('Failed to save message:', error)
      throw error
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || !user?.id) return

    let conversationId = currentConversationId
    
    // Create new conversation if none exists
    if (!conversationId) {
      const newConversation: Conversation = {
        id: `conv_${Date.now()}`,
        title: generateTitle(input),
        messages: [],
        updatedAt: new Date()
      }

      try {
        await blink.db.conversations.create({
          id: newConversation.id,
          userId: user.id,
          title: newConversation.title,
          createdAt: new Date(),
          updatedAt: new Date()
        })

        setConversations(prev => [newConversation, ...prev])
        conversationId = newConversation.id
        setCurrentConversationId(conversationId)
      } catch (error) {
        console.error('Failed to create conversation:', error)
        toast.error('Failed to create conversation')
        return
      }
    }

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    // Add user message to UI immediately
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

    const userInput = input
    setInput('')
    setIsLoading(true)
    setIsStreaming(true)
    setStreamingContent('')

    try {
      // Save user message to database
      await saveMessage(conversationId, 'user', userInput)

      // Update conversation title if it's the first message
      const conversation = conversations.find(c => c.id === conversationId)
      if (conversation && conversation.messages.length === 0) {
        await updateConversationTitle(conversationId, generateTitle(userInput))
      }

      // Get conversation history for context
      const messages = currentConversation?.messages || []
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      // Add the new user message
      conversationHistory.push({
        role: 'user',
        content: userInput
      })

      let fullResponse = ''

      // Stream AI response
      await blink.ai.streamText(
        {
          messages: conversationHistory,
          model: 'gpt-4o-mini',
          maxTokens: 2000
        },
        (chunk) => {
          fullResponse += chunk
          setStreamingContent(fullResponse)
        }
      )

      // Clear streaming content first, then add assistant message to UI
      setStreamingContent('')
      setIsStreaming(false)
      
      // Create assistant message
      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: fullResponse,
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

      // Save assistant message to database
      await saveMessage(conversationId, 'assistant', fullResponse)

    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message. Please try again.')
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('Message copied to clipboard')
  }

  const regenerateResponse = async () => {
    if (!currentConversation || !user?.id) return

    const messages = currentConversation.messages
    if (messages.length < 2) return

    // Remove the last assistant message
    const messagesWithoutLast = messages.slice(0, -1)
    const lastUserMessage = messagesWithoutLast[messagesWithoutLast.length - 1]

    if (!lastUserMessage || lastUserMessage.role !== 'user') return

    // Update UI to remove last assistant message
    setConversations(prev => prev.map(conv => 
      conv.id === currentConversationId 
        ? { 
            ...conv, 
            messages: messagesWithoutLast,
            updatedAt: new Date()
          }
        : conv
    ))

    setIsLoading(true)
    setIsStreaming(true)
    setStreamingContent('')

    try {
      // Delete the last assistant message from database
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'assistant') {
        await blink.db.messages.delete(lastMessage.id)
      }

      // Prepare conversation history
      const conversationHistory = messagesWithoutLast.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      let fullResponse = ''

      // Stream new AI response
      await blink.ai.streamText(
        {
          messages: conversationHistory,
          model: 'gpt-4o-mini',
          maxTokens: 2000
        },
        (chunk) => {
          fullResponse += chunk
          setStreamingContent(fullResponse)
        }
      )

      // Clear streaming content first, then add assistant message to UI
      setStreamingContent('')
      setIsStreaming(false)

      // Create new assistant message
      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date()
      }

      // Add new assistant message to UI
      setConversations(prev => prev.map(conv => 
        conv.id === currentConversationId 
          ? { 
              ...conv, 
              messages: [...conv.messages, assistantMessage],
              updatedAt: new Date()
            }
          : conv
      ))

      // Save new assistant message to database
      await saveMessage(currentConversationId!, 'assistant', fullResponse)

    } catch (error) {
      console.error('Failed to regenerate response:', error)
      toast.error('Failed to regenerate response')
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  const deleteConversation = async (conversationId: string) => {
    try {
      await blink.db.conversations.delete(conversationId)
      setConversations(prev => prev.filter(c => c.id !== conversationId))
      
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null)
      }
      
      toast.success('Conversation deleted')
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      toast.error('Failed to delete conversation')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-[hsl(var(--chatgpt-primary))] rounded-full flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Welcome to ChatGPT Clone</h1>
          <p className="text-[hsl(var(--chatgpt-text-secondary))] mb-4">
            Please sign in to start chatting with AI
          </p>
          <Button 
            onClick={() => blink.auth.login()}
            className="bg-[hsl(var(--chatgpt-primary))] hover:bg-[hsl(var(--chatgpt-primary-hover))]"
          >
            Sign In
          </Button>
        </div>
      </div>
    )
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
              <div key={conversation.id} className="group relative">
                <Button
                  onClick={() => setCurrentConversationId(conversation.id)}
                  variant="ghost"
                  className={`w-full justify-start text-left h-auto p-3 chatgpt-sidebar-item ${
                    currentConversationId === conversation.id ? 'bg-[hsl(var(--chatgpt-sidebar-hover))]' : ''
                  }`}
                >
                  <MessageSquare className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate text-sm">{conversation.title}</span>
                </Button>
                <Button
                  onClick={() => deleteConversation(conversation.id)}
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-red-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
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
          <Button 
            variant="ghost" 
            className="w-full justify-start chatgpt-sidebar-item"
            onClick={() => blink.auth.logout()}
          >
            <User className="w-4 h-4 mr-2" />
            Sign out ({user.email})
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
                              disabled={isLoading}
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
                
                {/* Streaming response */}
                {isStreaming && streamingContent && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-[hsl(var(--chatgpt-primary))] rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-muted p-4 rounded-2xl max-w-[70%]">
                      <p className="whitespace-pre-wrap">{streamingContent}</p>
                      <div className="inline-block w-2 h-4 bg-[hsl(var(--chatgpt-primary))] animate-pulse ml-1"></div>
                    </div>
                  </div>
                )}
                
                {/* Loading indicator */}
                {isLoading && !isStreaming && (
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
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
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